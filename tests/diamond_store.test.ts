import { beforeAll, describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

let createApp: typeof import('../server').createApp;
let db: typeof import('../server/db').db;
let seedDevelopmentCatalog: typeof import('../server/seed-dev').seedDevelopmentCatalog;

// Use an isolated temporary database for tests
const testDbPath = path.resolve(process.cwd(), 'data', `test_${Date.now()}.db`);

let baseUrl = '';
let server: ReturnType<ReturnType<typeof import('../server').createApp>['listen']>;

async function req(
  pathname: string,
  options: { method?: string; body?: unknown; cookie?: string } = {}
) {
  const res = await fetch(`${baseUrl}${pathname}`, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.cookie ? { Cookie: options.cookie } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const setCookie = res.headers.getSetCookie?.() || [];
  const rawCookie = setCookie.map((c) => c.split(';')[0]).join('; ');
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json, cookie: rawCookie };
}

beforeAll(async () => {
  process.env.DIAMOND_DB_PATH = testDbPath;
  process.env.ADMIN_BOOTSTRAP_SECRET = 'TestBootstrapSecret_998877';
  process.env.NODE_ENV = 'test';

  const serverMod = await import('../server');
  const dbMod = await import('../server/db');
  const seedMod = await import('../server/seed-dev');
  createApp = serverMod.createApp;
  db = dbMod.db;
  seedDevelopmentCatalog = seedMod.seedDevelopmentCatalog;

  const app = createApp();
  seedDevelopmentCatalog(true);
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });

  return () => {
    server?.close();
    for (const suffix of ['', '-wal', '-shm']) {
      if (fs.existsSync(`${testDbPath}${suffix}`)) {
        fs.unlinkSync(`${testDbPath}${suffix}`);
      }
    }
  };
});

describe('Diamond Store End-to-End Business Logic & Security', () => {
  let adminCookie = '';
  let customerCookie = '';
  let createdProductId = '';
  let createdVariantId = '';
  let orderNumber = '';

  it('blocks unauthenticated access to admin routes', async () => {
    const res = await req('/api/admin/dashboard');
    expect(res.status).toBe(401);
  });

  it('rejects invalid bootstrap secret and allows one-time Super Admin bootstrap', async () => {
    const bad = await req('/api/admin/bootstrap', {
      method: 'POST',
      body: {
        bootstrap_secret: 'wrong-secret-1234',
        full_name: 'Owner',
        email: 'owner@diamondstore.test',
        password: 'StrongAdminPassword123',
      },
    });
    expect(bad.status).toBe(403);

    const good = await req('/api/admin/bootstrap', {
      method: 'POST',
      body: {
        bootstrap_secret: 'TestBootstrapSecret_998877',
        full_name: 'Super Admin',
        email: 'owner@diamondstore.test',
        password: 'StrongAdminPassword123',
      },
    });
    expect(good.status).toBe(201);
    adminCookie = good.cookie;

    // Second bootstrap attempt must be permanently rejected
    const second = await req('/api/admin/bootstrap', {
      method: 'POST',
      body: {
        bootstrap_secret: 'TestBootstrapSecret_998877',
        full_name: 'Attacker',
        email: 'attacker@diamondstore.test',
        password: 'StrongAdminPassword123',
      },
    });
    expect(second.status).toBe(403);
  });

  it('allows customer registration, login, and blocks customer from admin routes', async () => {
    const reg = await req('/api/auth/register', {
      method: 'POST',
      body: {
        full_name: 'Tunde Adeyemi',
        email: 'tunde@example.com',
        phone: '08000000001',
        password: 'CustomerPassword123',
      },
    });
    expect(reg.status).toBe(201);
    customerCookie = reg.cookie;

    // Customer cannot access admin dashboard even with valid customer cookie
    const forbiddenAdmin = await req('/api/admin/dashboard', { cookie: customerCookie });
    expect(forbiddenAdmin.status).toBe(401);

    // Customer cannot elevate role via profile update
    await req('/api/account/profile', {
      method: 'PUT',
      cookie: customerCookie,
      body: { full_name: 'Tunde Adeyemi', role: 'super_admin' },
    });
    const checkProfile = db
      .prepare("SELECT role FROM profiles WHERE email = 'tunde@example.com'")
      .get() as { role: string };
    expect(checkProfile.role).toBe('customer');
  });

  it('enforces staff permissions and allows Super Admin to create restricted staff', async () => {
    const staffCreate = await req('/api/admin/staff', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        full_name: 'Content Editor',
        email: 'editor@diamondstore.test',
        password: 'EditorPassword123',
        role: 'content_manager',
      },
    });
    expect(staffCreate.status).toBe(201);

    const editorLogin = await req('/api/admin/login', {
      method: 'POST',
      body: { email: 'editor@diamondstore.test', password: 'EditorPassword123' },
    });
    expect(editorLogin.status).toBe(200);

    // Content manager cannot access Super Admin staff management or orders
    const deniedStaff = await req('/api/admin/staff', { cookie: editorLogin.cookie });
    expect(deniedStaff.status).toBe(403);
    const deniedOrders = await req('/api/admin/orders', { cookie: editorLogin.cookie });
    expect(deniedOrders.status).toBe(403);
  });

  it('creates product with independent variants, publishes to storefront, and prevents overselling', async () => {
    const prodRes = await req('/api/admin/products', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        name: 'Test Tailored Agbada Set',
        slug: 'test-tailored-agbada-set',
        sku: 'DS-TEST-001',
        description: 'Hand-embroidered formal wear.',
        regular_price_kobo: 9500000,
        sale_price_kobo: 8500000,
        is_featured: true,
        is_bestseller: false,
        status: 'published',
        low_stock_threshold: 2,
        images: [{ url: '/src/assets/images/product_wool_blazer_1795111181387.jpg', alt_text: 'Agbada', sort_order: 0 }],
        variants: [
          {
            sku: 'DS-TEST-001-BLK-L',
            size: 'L',
            color: 'Midnight Black',
            color_hex: '#101820',
            quantity_on_hand: 3,
            low_stock_threshold: 2,
          },
        ],
      },
    });
    expect(prodRes.status).toBe(201);
    createdProductId = (prodRes.json as { id: string }).id;

    // Fetch via public storefront endpoint
    const publicDetail = await req('/api/products/test-tailored-agbada-set');
    expect(publicDetail.status).toBe(200);
    const prod = (publicDetail.json as { product: { variants: { id: string; available_stock: number }[] } }).product;
    createdVariantId = prod.variants[0].id;
    expect(prod.variants[0].available_stock).toBe(3);

    // Overselling test: requesting 5 units when only 3 exist must fail
    const oversell = await req('/api/orders', {
      method: 'POST',
      cookie: customerCookie,
      body: {
        idempotency_key: `idem-${crypto.randomUUID()}`,
        customer_name: 'Tunde Adeyemi',
        customer_email: 'tunde@example.com',
        customer_phone: '08000000001',
        country: 'Nigeria',
        state: 'Oyo',
        city: 'Ogbomoso',
        delivery_address: '10 Test Avenue',
        payment_method: 'cash_on_delivery',
        items: [{ variant_id: createdVariantId, quantity: 5 }],
      },
    });
    expect(oversell.status).toBe(400);

    // Valid order with coupon DIAMOND10 (10% off ₦85,000 * 2 = ₦170,000 -> ₦17,000 discount -> ₦153,000)
    const idemKey = `idem-${crypto.randomUUID()}`;
    const validOrder = await req('/api/orders', {
      method: 'POST',
      cookie: customerCookie,
      body: {
        idempotency_key: idemKey,
        customer_name: 'Tunde Adeyemi',
        customer_email: 'tunde@example.com',
        customer_phone: '08000000001',
        country: 'Nigeria',
        state: 'Oyo',
        city: 'Ogbomoso',
        delivery_address: '10 Test Avenue',
        payment_method: 'cash_on_delivery',
        coupon_code: 'DIAMOND10',
        items: [{ variant_id: createdVariantId, quantity: 2 }],
      },
    });
    expect(validOrder.status).toBe(201);
    const orderData = (validOrder.json as { order: { order_number: string; total_kobo: number; discount_kobo: number } }).order;
    orderNumber = orderData.order_number;
    expect(orderData.discount_kobo).toBe(1700000);
    expect(orderData.total_kobo).toBe(15300000);

    // Duplicate idempotency key does not create a second order or double-deduct stock
    const dupOrder = await req('/api/orders', {
      method: 'POST',
      cookie: customerCookie,
      body: {
        idempotency_key: idemKey,
        customer_name: 'Tunde Adeyemi',
        customer_email: 'tunde@example.com',
        customer_phone: '08000000001',
        country: 'Nigeria',
        state: 'Oyo',
        city: 'Ogbomoso',
        delivery_address: '10 Test Avenue',
        payment_method: 'cash_on_delivery',
        coupon_code: 'DIAMOND10',
        items: [{ variant_id: createdVariantId, quantity: 2 }],
      },
    });
    expect(dupOrder.status).toBe(200);
    expect((dupOrder.json as { duplicate: boolean }).duplicate).toBe(true);

    // Remaining stock should be 1
    const afterDetail = await req('/api/products/test-tailored-agbada-set');
    const afterProd = (afterDetail.json as { product: { variants: { available_stock: number }[] } }).product;
    expect(afterProd.variants[0].available_stock).toBe(1);
  });

  it('tracks order with verification and prevents unauthorized tracking', async () => {
    const badTrack = await req('/api/orders/track', {
      method: 'POST',
      body: { order_number: orderNumber, verification: 'wrong@example.com' },
    });
    expect(badTrack.status).toBe(404);

    const goodTrack = await req('/api/orders/track', {
      method: 'POST',
      body: { order_number: orderNumber, verification: 'tunde@example.com' },
    });
    expect(goodTrack.status).toBe(200);
    expect((goodTrack.json as { order: { order_number: string } }).order.order_number).toBe(orderNumber);
  });

  it('safeguards product linked to historical orders by hiding instead of hard deleting', async () => {
    const delRes = await req(`/api/admin/products/${createdProductId}`, {
      method: 'DELETE',
      cookie: adminCookie,
    });
    expect(delRes.status).toBe(200);
    expect((delRes.json as { archived: boolean }).archived).toBe(true);
  });

  it('computes live dashboard KPIs and reports accurately', async () => {
    const dash = await req('/api/admin/dashboard?period=monthly', { cookie: adminCookie });
    expect(dash.status).toBe(200);
    const kpis = (dash.json as { kpis: { total_orders: number } }).kpis;
    expect(kpis.total_orders).toBeGreaterThanOrEqual(1);

    const reports = await req('/api/admin/reports?period=monthly', { cookie: adminCookie });
    expect(reports.status).toBe(200);
  });
});
