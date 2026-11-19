import { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { db, getSetting } from '../db';
import { resolveSessionUser } from '../security';
import { createOrderAtomic, releaseExpiredReservations, validateCouponForSubtotal } from '../services/orders';
import { getPaymentReadiness, initializeOnlinePayment } from '../services/payments';
import { createNotification } from '../services/notifications';

export const publicRouter = Router();

publicRouter.get('/storefront', (_req, res) => {
  const general = getSetting<Record<string, unknown>>('general') || {};
  const delivery = getSetting<Record<string, unknown>>('delivery') || {};
  const returns = getSetting<Record<string, unknown>>('returns') || {};
  const contentRows = db.prepare('SELECT key, title, body, updated_at FROM content').all() as {
    key: string;
    title: string;
    body: string;
    updated_at: string;
  }[];

  const content: Record<string, { title: string; body: unknown; updated_at: string }> = {};
  for (const row of contentRows) {
    content[row.key] = {
      title: row.title,
      body: JSON.parse(row.body),
      updated_at: row.updated_at,
    };
  }

  const categories = db
    .prepare('SELECT id, name, slug, description, image_url, display_order FROM categories WHERE is_active = 1 ORDER BY display_order ASC, name ASC')
    .all();

  const paymentReadiness = getPaymentReadiness();
  const enabledPaymentMethods = [
    ...(paymentReadiness.paystack.ready
      ? [{ id: 'paystack', label: 'Pay with Paystack', mode: paymentReadiness.paystack.mode }]
      : []),
    ...(paymentReadiness.flutterwave.ready
      ? [{ id: 'flutterwave', label: 'Pay with Flutterwave', mode: paymentReadiness.flutterwave.mode }]
      : []),
    ...(paymentReadiness.bank_transfer.ready
      ? [
          {
            id: 'bank_transfer',
            label: 'Direct Bank Transfer',
            bank_name: paymentReadiness.bank_transfer.bank_name,
            account_name: paymentReadiness.bank_transfer.account_name,
            account_number: paymentReadiness.bank_transfer.account_number,
            instructions: paymentReadiness.bank_transfer.instructions,
          },
        ]
      : []),
    ...(paymentReadiness.cash_on_delivery.ready
      ? [
          {
            id: 'cash_on_delivery',
            label: 'Cash on Delivery',
            instructions: paymentReadiness.cash_on_delivery.instructions,
          },
        ]
      : []),
  ];

  res.json({
    settings: {
      general,
      delivery,
      returns,
    },
    content,
    categories,
    payment_methods: enabledPaymentMethods,
  });
});

function hydrateProducts(productRows: Record<string, unknown>[]) {
  if (productRows.length === 0) return [];
  const ids = productRows.map((p) => p.id as string);
  const placeholders = ids.map(() => '?').join(',');

  const images = db
    .prepare(`SELECT * FROM product_images WHERE product_id IN (${placeholders}) ORDER BY sort_order ASC`)
    .all(...ids) as Record<string, unknown>[];

  const variants = db
    .prepare(`
      SELECT pv.*, inv.quantity_on_hand, inv.quantity_reserved,
             MAX(0, inv.quantity_on_hand - inv.quantity_reserved) as available_stock
      FROM product_variants pv
      LEFT JOIN inventory inv ON inv.variant_id = pv.id
      WHERE pv.product_id IN (${placeholders}) AND pv.is_active = 1
      ORDER BY pv.size ASC, pv.color ASC
    `)
    .all(...ids) as Record<string, unknown>[];

  return productRows.map((p) => {
    const pImages = images.filter((i) => i.product_id === p.id);
    const pVariants = variants.filter((v) => v.product_id === p.id);
    const totalAvailable = pVariants.reduce((sum, v) => sum + Number(v.available_stock || 0), 0);
    return {
      ...p,
      is_featured: Boolean(p.is_featured),
      is_bestseller: Boolean(p.is_bestseller),
      images: pImages,
      variants: pVariants,
      total_available_stock: totalAvailable,
    };
  });
}

publicRouter.get('/products', (req, res) => {
  releaseExpiredReservations();

  const categorySlug = String(req.query.category || '').trim();
  const search = String(req.query.search || '').trim().toLowerCase();
  const minPrice = req.query.minPrice ? Number(req.query.minPrice) * 100 : null;
  const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) * 100 : null;
  const size = String(req.query.size || '').trim();
  const color = String(req.query.color || '').trim();
  const inStock = req.query.inStock === 'true';
  const onSale = req.query.onSale === 'true';
  const featured = req.query.featured === 'true';
  const bestseller = req.query.bestseller === 'true';
  const sort = String(req.query.sort || 'latest');
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(48, Math.max(1, Number(req.query.limit || 12)));

  let sql = `
    SELECT p.*, c.name as category_name, c.slug as category_slug
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.status = 'published'
  `;
  const params: unknown[] = [];

  if (categorySlug) {
    if (categorySlug === 'new-arrivals') {
      // Recently published products
    } else if (categorySlug === 'best-sellers') {
      sql += ` AND p.is_bestseller = 1`;
    } else if (categorySlug === 'special-offers') {
      sql += ` AND p.sale_price_kobo IS NOT NULL AND p.sale_price_kobo < p.regular_price_kobo`;
    } else {
      sql += ` AND c.slug = ?`;
      params.push(categorySlug);
    }
  }

  if (search) {
    sql += ` AND (LOWER(p.name) LIKE ? OR LOWER(p.description) LIKE ? OR LOWER(p.sku) LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (minPrice !== null && Number.isFinite(minPrice)) {
    sql += ` AND COALESCE(p.sale_price_kobo, p.regular_price_kobo) >= ?`;
    params.push(minPrice);
  }
  if (maxPrice !== null && Number.isFinite(maxPrice)) {
    sql += ` AND COALESCE(p.sale_price_kobo, p.regular_price_kobo) <= ?`;
    params.push(maxPrice);
  }
  if (onSale) {
    sql += ` AND p.sale_price_kobo IS NOT NULL AND p.sale_price_kobo < p.regular_price_kobo`;
  }
  if (featured) {
    sql += ` AND p.is_featured = 1`;
  }
  if (bestseller) {
    sql += ` AND p.is_bestseller = 1`;
  }
  if (size) {
    sql += ` AND EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active = 1 AND LOWER(pv.size) = ?)`;
    params.push(size.toLowerCase());
  }
  if (color) {
    sql += ` AND EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active = 1 AND LOWER(pv.color) = ?)`;
    params.push(color.toLowerCase());
  }
  if (inStock) {
    sql += ` AND EXISTS (
      SELECT 1 FROM product_variants pv
      JOIN inventory inv ON inv.variant_id = pv.id
      WHERE pv.product_id = p.id AND pv.is_active = 1 AND (inv.quantity_on_hand - inv.quantity_reserved) > 0
    )`;
  }

  switch (sort) {
    case 'price_asc':
      sql += ` ORDER BY COALESCE(p.sale_price_kobo, p.regular_price_kobo) ASC`;
      break;
    case 'price_desc':
      sql += ` ORDER BY COALESCE(p.sale_price_kobo, p.regular_price_kobo) DESC`;
      break;
    case 'bestselling':
      sql += ` ORDER BY p.is_bestseller DESC, p.created_at DESC`;
      break;
    case 'featured':
      sql += ` ORDER BY p.is_featured DESC, p.created_at DESC`;
      break;
    default:
      sql += ` ORDER BY p.created_at DESC`;
  }

  const allMatching = db.prepare(sql).all(...params) as Record<string, unknown>[];
  const total = allMatching.length;
  const start = (page - 1) * limit;
  const paged = allMatching.slice(start, start + limit);

  // Also return available facet sizes & colors across published catalog
  const facetSizes = db
    .prepare(`
      SELECT DISTINCT pv.size FROM product_variants pv
      JOIN products p ON p.id = pv.product_id
      WHERE p.status = 'published' AND pv.is_active = 1
      ORDER BY pv.size ASC
    `)
    .all() as { size: string }[];

  const facetColors = db
    .prepare(`
      SELECT DISTINCT pv.color, pv.color_hex FROM product_variants pv
      JOIN products p ON p.id = pv.product_id
      WHERE p.status = 'published' AND pv.is_active = 1
      ORDER BY pv.color ASC
    `)
    .all() as { color: string; color_hex: string }[];

  res.json({
    items: hydrateProducts(paged),
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.max(1, Math.ceil(total / limit)),
    },
    facets: {
      sizes: facetSizes.map((s) => s.size),
      colors: facetColors,
    },
  });
});

publicRouter.get('/products/:slug', (req, res) => {
  releaseExpiredReservations();

  const row = db
    .prepare(`
      SELECT p.*, c.name as category_name, c.slug as category_slug
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.slug = ? AND p.status = 'published'
    `)
    .get(req.params.slug) as Record<string, unknown> | undefined;

  if (!row) {
    res.status(404).json({ error: 'Product not found.' });
    return;
  }

  const [product] = hydrateProducts([row]);
  const relatedRows = db
    .prepare(`
      SELECT p.*, c.name as category_name, c.slug as category_slug
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.status = 'published' AND p.id != ? AND (? IS NULL OR p.category_id = ?)
      ORDER BY p.is_featured DESC, p.created_at DESC
      LIMIT 4
    `)
    .all(row.id, row.category_id ?? null, row.category_id ?? null) as Record<string, unknown>[];

  res.json({
    product,
    related: hydrateProducts(relatedRows),
  });
});

publicRouter.post('/coupons/validate', (req, res) => {
  const schema = z.object({
    code: z.string().min(1),
    subtotal_kobo: z.number().int().min(0),
    email: z.string().email().optional().or(z.literal('')),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Please provide a valid coupon code and subtotal.' });
    return;
  }

  const check = validateCouponForSubtotal(
    parsed.data.code,
    parsed.data.subtotal_kobo,
    parsed.data.email || undefined
  );
  if (!check.valid) {
    res.status(400).json({ error: check.error });
    return;
  }

  res.json({
    valid: true,
    code: check.coupon.code,
    discount_type: check.coupon.discount_type,
    discount_value: check.coupon.discount_value,
    discount_kobo: check.discount_kobo,
  });
});

publicRouter.post('/orders', async (req, res) => {
  const schema = z.object({
    idempotency_key: z.string().min(8).max(120).optional(),
    customer_name: z.string().min(2),
    customer_email: z.string().email(),
    customer_phone: z.string().min(6),
    customer_whatsapp: z.string().optional(),
    country: z.string().min(2),
    state: z.string().min(2),
    city: z.string().min(2),
    delivery_address: z.string().min(5),
    postal_code: z.string().optional(),
    delivery_instructions: z.string().optional(),
    payment_method: z.enum(['paystack', 'flutterwave', 'bank_transfer', 'cash_on_delivery']),
    coupon_code: z.string().optional(),
    items: z
      .array(
        z.object({
          variant_id: z.string().min(1),
          quantity: z.number().int().min(1).max(50),
        })
      )
      .min(1),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid checkout details.' });
    return;
  }

  const readiness = getPaymentReadiness();
  const chosenMethod = parsed.data.payment_method;
  if (!readiness[chosenMethod].ready) {
    res.status(400).json({
      error: `Selected payment method (${chosenMethod.replace('_', ' ')}) is not currently enabled or configured.`,
    });
    return;
  }

  const customerUser = resolveSessionUser(req, 'customer');

  try {
    const outcome = createOrderAtomic({
      idempotencyKey: parsed.data.idempotency_key,
      customerProfileId: customerUser?.id ?? null,
      customerName: parsed.data.customer_name,
      customerEmail: parsed.data.customer_email,
      customerPhone: parsed.data.customer_phone,
      customerWhatsapp: parsed.data.customer_whatsapp,
      country: parsed.data.country,
      state: parsed.data.state,
      city: parsed.data.city,
      deliveryAddress: parsed.data.delivery_address,
      postalCode: parsed.data.postal_code,
      deliveryInstructions: parsed.data.delivery_instructions,
      paymentMethod: chosenMethod,
      couponCode: parsed.data.coupon_code,
      items: parsed.data.items.map((i) => ({ variantId: i.variant_id, quantity: i.quantity })),
    });

    const order = outcome.order as {
      id: string;
      order_number: string;
      total_kobo: number;
      currency: string;
    };

    let paymentAction: { authorization_url?: string; reference?: string } = {};
    if (!outcome.duplicate && (chosenMethod === 'paystack' || chosenMethod === 'flutterwave')) {
      const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
      const callbackUrl = `${appUrl}/checkout?verify=1&provider=${chosenMethod}&order=${encodeURIComponent(
        order.order_number
      )}`;
      paymentAction = await initializeOnlinePayment({
        provider: chosenMethod,
        orderId: order.id,
        orderNumber: order.order_number,
        email: parsed.data.customer_email,
        customerName: parsed.data.customer_name,
        amountKobo: order.total_kobo,
        currency: order.currency,
        reference: outcome.paymentReference || `PAY-${order.order_number}`,
        callbackUrl,
      });
    }

    res.status(outcome.duplicate ? 200 : 201).json({
      order: outcome.order,
      duplicate: outcome.duplicate,
      payment: paymentAction,
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to place order.' });
  }
});

publicRouter.post('/orders/track', (req, res) => {
  const schema = z.object({
    order_number: z.string().min(3),
    verification: z.string().min(3),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Enter your order number and verification email or phone number.' });
    return;
  }

  const order = db
    .prepare('SELECT * FROM orders WHERE UPPER(order_number) = ?')
    .get(parsed.data.order_number.trim().toUpperCase()) as Record<string, unknown> | undefined;

  if (!order) {
    res.status(404).json({ error: 'No order matched that order number and verification detail.' });
    return;
  }

  const ver = parsed.data.verification.trim().toLowerCase();
  const matchesEmail = String(order.customer_email).toLowerCase() === ver;
  const matchesPhone = String(order.customer_phone).replace(/\s+/g, '') === ver.replace(/\s+/g, '');
  if (!matchesEmail && !matchesPhone) {
    res.status(404).json({ error: 'No order matched that order number and verification detail.' });
    return;
  }

  const items = db
    .prepare('SELECT product_name, size, color, quantity, unit_price_kobo, line_total_kobo FROM order_items WHERE order_id = ?')
    .all(order.id);
  const delivery = db
    .prepare(`
      SELECT delivery_fee_kobo, fee_payment_timing, delivery_scope, courier_company, tracking_number, estimated_delivery_date, status
      FROM deliveries WHERE order_id = ?
    `)
    .get(order.id);
  const history = db
    .prepare('SELECT status, note, created_at FROM order_status_history WHERE order_id = ? ORDER BY created_at ASC')
    .all(order.id);

  // Return strictly customer-safe fields (no internal_notes!)
  res.json({
    order: {
      order_number: order.order_number,
      customer_name: order.customer_name,
      country: order.country,
      state: order.state,
      city: order.city,
      currency: order.currency,
      subtotal_kobo: order.subtotal_kobo,
      discount_kobo: order.discount_kobo,
      delivery_fee_kobo: order.delivery_fee_kobo,
      delivery_fee_payable_on_arrival: Boolean(order.delivery_fee_payable_on_arrival),
      total_kobo: order.total_kobo,
      payment_method: order.payment_method,
      payment_status: order.payment_status,
      order_status: order.order_status,
      cancellation_reason: order.cancellation_reason,
      created_at: order.created_at,
    },
    items,
    delivery,
    history,
  });
});

publicRouter.post('/newsletter/subscribe', (req, res) => {
  const schema = z.object({ email: z.string().email() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Please enter a valid email address.' });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const token = crypto.randomBytes(24).toString('hex');

  db.prepare(`
    INSERT INTO newsletter_subscribers (id, email, status, unsubscribe_token)
    VALUES (?, ?, 'subscribed', ?)
    ON CONFLICT(email) DO UPDATE SET status = 'subscribed', updated_at = datetime('now')
  `).run(crypto.randomUUID(), email, token);

  res.json({ message: 'You have subscribed to Diamond Store dispatches.', unsubscribe_token: token });
});

publicRouter.post('/newsletter/unsubscribe', (req, res) => {
  const schema = z.object({
    email: z.string().email().optional(),
    token: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success || (!parsed.data.email && !parsed.data.token)) {
    res.status(400).json({ error: 'Provide an email address or unsubscribe token.' });
    return;
  }

  if (parsed.data.token) {
    db.prepare("UPDATE newsletter_subscribers SET status = 'unsubscribed', updated_at = datetime('now') WHERE unsubscribe_token = ?").run(
      parsed.data.token
    );
  } else if (parsed.data.email) {
    db.prepare("UPDATE newsletter_subscribers SET status = 'unsubscribed', updated_at = datetime('now') WHERE LOWER(email) = ?").run(
      parsed.data.email.toLowerCase()
    );
  }

  res.json({ message: 'You have been unsubscribed from Diamond Store emails.' });
});

publicRouter.post('/contact', (req, res) => {
  const schema = z.object({
    name: z.string().min(2),
    email: z.string().email(),
    subject: z.string().min(2),
    message: z.string().min(10),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Please complete all fields in your inquiry.' });
    return;
  }

  createNotification({
    recipientType: 'admin',
    title: `Customer Inquiry: ${parsed.data.subject}`,
    message: `From ${parsed.data.name} (${parsed.data.email}): ${parsed.data.message}`,
  });

  res.json({ message: 'Your inquiry has been recorded for our store team.' });
});

publicRouter.post('/returns', (req, res) => {
  const returnsSettings = getSetting<{ enabled?: boolean }>('returns');
  if (!returnsSettings?.enabled) {
    res.status(403).json({ error: 'Returns are currently disabled by Diamond Store policy.' });
    return;
  }

  const schema = z.object({
    order_number: z.string().min(3),
    email: z.string().email(),
    reason: z.string().min(10),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Provide order number, email, and return reason.' });
    return;
  }

  const order = db
    .prepare('SELECT id, order_number FROM orders WHERE UPPER(order_number) = ? AND LOWER(customer_email) = ?')
    .get(parsed.data.order_number.trim().toUpperCase(), parsed.data.email.trim().toLowerCase()) as
    | { id: string; order_number: string }
    | undefined;
  if (!order) {
    res.status(404).json({ error: 'Order not found for that email address.' });
    return;
  }

  db.prepare(`
    INSERT INTO returns (id, order_id, customer_email, reason, status)
    VALUES (?, ?, ?, ?, 'pending')
  `).run(crypto.randomUUID(), order.id, parsed.data.email.toLowerCase(), parsed.data.reason);

  createNotification({
    recipientType: 'admin',
    title: `Return Request · ${order.order_number}`,
    message: `${parsed.data.email} requested a return for order ${order.order_number}.`,
  });

  res.status(201).json({ message: 'Your return request has been submitted for review.' });
});
