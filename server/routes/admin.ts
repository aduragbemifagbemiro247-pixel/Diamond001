import { Router } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { db, getSetting, setSetting } from '../db';
import {
  ALL_PERMISSIONS,
  AuthenticatedRequest,
  DEFAULT_ROLE_PERMISSIONS,
  Permission,
  STAFF_ROLES,
  StaffRole,
  hashPassword,
  logAdminActivity,
  requirePermission,
  requireStaff,
  requireSuperAdmin,
} from '../security';
import { getPaymentReadiness, PaymentGatewaySettings } from '../services/payments';
import { createNotification } from '../services/notifications';
import { seedDevelopmentCatalog } from '../seed-dev';

export const adminRouter = Router();

// All routes in adminRouter require authenticated staff session
adminRouter.use(requireStaff);

// ==================== DASHBOARD ANALYTICS ====================

adminRouter.get('/dashboard', (req, res) => {
  const period = String(req.query.period || 'monthly');
  let cutoffSql = "datetime('now', '-30 days')";
  let groupFormat = '%Y-%m-%d';

  if (period === 'daily') {
    cutoffSql = "datetime('now', '-1 day')";
    groupFormat = '%H:00';
  } else if (period === 'weekly') {
    cutoffSql = "datetime('now', '-7 days')";
    groupFormat = '%Y-%m-%d';
  } else if (period === 'yearly') {
    cutoffSql = "datetime('now', '-365 days')";
    groupFormat = '%Y-%m';
  }

  const totalSalesRow = db
    .prepare(`
      SELECT COALESCE(SUM(total_kobo), 0) as total
      FROM orders
      WHERE payment_status = 'paid' AND created_at >= ${cutoffSql}
    `)
    .get() as { total: number };

  const orderCounts = db
    .prepare(`
      SELECT
        COUNT(*) as total_orders,
        SUM(CASE WHEN order_status IN ('order_placed', 'payment_confirmed', 'processing', 'ready_for_dispatch', 'shipped', 'out_for_delivery') THEN 1 ELSE 0 END) as pending_orders,
        SUM(CASE WHEN order_status = 'delivered' THEN 1 ELSE 0 END) as completed_orders,
        SUM(CASE WHEN order_status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_orders
      FROM orders
      WHERE created_at >= ${cutoffSql}
    `)
    .get() as {
    total_orders: number;
    pending_orders: number | null;
    completed_orders: number | null;
    cancelled_orders: number | null;
  };

  const customerCount = db.prepare('SELECT COUNT(*) as c FROM customers').get() as { c: number };
  const productCount = db
    .prepare("SELECT COUNT(*) as c FROM products WHERE status = 'published'")
    .get() as { c: number };

  const lowStockRows = db
    .prepare(`
      SELECT
        pv.id as variant_id, pv.sku, pv.size, pv.color,
        p.id as product_id, p.name as product_name,
        inv.quantity_on_hand, inv.quantity_reserved,
        MAX(0, inv.quantity_on_hand - inv.quantity_reserved) as available_stock,
        inv.low_stock_threshold
      FROM inventory inv
      JOIN product_variants pv ON pv.id = inv.variant_id
      JOIN products p ON p.id = pv.product_id
      WHERE (inv.quantity_on_hand - inv.quantity_reserved) <= inv.low_stock_threshold
      ORDER BY available_stock ASC
      LIMIT 15
    `)
    .all();

  const txCounts = db
    .prepare(`
      SELECT
        SUM(CASE WHEN status = 'successful' THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM payments
      WHERE created_at >= ${cutoffSql}
    `)
    .get() as { successful: number | null; failed: number | null };

  const salesSeries = db
    .prepare(`
      SELECT strftime('${groupFormat}', created_at) as bucket,
             COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total_kobo ELSE 0 END), 0) as collected_kobo,
             COALESCE(SUM(total_kobo), 0) as order_value_kobo,
             COUNT(*) as orders
      FROM orders
      WHERE created_at >= ${cutoffSql} AND order_status != 'cancelled'
      GROUP BY bucket
      ORDER BY bucket ASC
    `)
    .all();

  const recentOrders = db
    .prepare(`
      SELECT id, order_number, customer_name, customer_email, total_kobo, payment_method, payment_status, order_status, created_at
      FROM orders
      ORDER BY created_at DESC
      LIMIT 8
    `)
    .all();

  const recentTransactions = db
    .prepare(`
      SELECT p.id, p.reference, p.provider, p.amount_kobo, p.status, p.created_at, o.order_number, o.customer_name
      FROM payments p
      JOIN orders o ON o.id = p.order_id
      ORDER BY p.created_at DESC
      LIMIT 8
    `)
    .all();

  const bestSellingProducts = db
    .prepare(`
      SELECT oi.product_id, oi.product_name, SUM(oi.quantity) as units_sold, SUM(oi.line_total_kobo) as revenue_kobo
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.order_status != 'cancelled'
      GROUP BY oi.product_id, oi.product_name
      ORDER BY units_sold DESC
      LIMIT 6
    `)
    .all();

  const orderStatusOverview = db
    .prepare(`
      SELECT order_status, COUNT(*) as count
      FROM orders
      GROUP BY order_status
    `)
    .all();

  res.json({
    period,
    kpis: {
      total_sales_kobo: totalSalesRow.total || 0,
      total_orders: orderCounts.total_orders || 0,
      pending_orders: orderCounts.pending_orders || 0,
      completed_orders: orderCounts.completed_orders || 0,
      cancelled_orders: orderCounts.cancelled_orders || 0,
      registered_customers: customerCount.c || 0,
      available_products: productCount.c || 0,
      low_stock_count: lowStockRows.length,
      successful_transactions: txCounts.successful || 0,
      failed_transactions: txCounts.failed || 0,
    },
    sales_series: salesSeries,
    recent_orders: recentOrders,
    recent_transactions: recentTransactions,
    best_selling_products: bestSellingProducts,
    low_stock_alerts: lowStockRows,
    order_status_overview: orderStatusOverview,
  });
});

// ==================== FILE / IMAGE UPLOAD ====================

adminRouter.post('/upload', (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    filename: z.string().min(1),
    data_url: z.string().min(10),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid upload payload.' });
    return;
  }

  const match = parsed.data.data_url.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/);
  if (!match) {
    res.status(400).json({ error: 'Only PNG, JPEG, or WebP images are supported.' });
    return;
  }

  const ext = match[1] === 'image/png' ? 'png' : match[1] === 'image/webp' ? 'webp' : 'jpg';
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.byteLength > 5 * 1024 * 1024) {
    res.status(400).json({ error: 'Image must be smaller than 5 MB.' });
    return;
  }

  const uploadsDir = path.resolve(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const safeBase = parsed.data.filename.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
  const fileName = `${safeBase}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(uploadsDir, fileName), buffer);

  res.status(201).json({ url: `/uploads/${fileName}` });
});

adminRouter.post('/seed-dev', requirePermission('products'), (req: AuthenticatedRequest, res) => {
  const result = seedDevelopmentCatalog(false);
  logAdminActivity({
    actorId: req.authUser!.id,
    actorEmail: req.authUser!.email,
    action: 'seed_development_catalog',
    entityType: 'products',
    details: result,
    ipAddress: req.ip,
  });
  res.json(result);
});

// ==================== PRODUCT MANAGEMENT ====================

adminRouter.get('/products', requirePermission('products'), (_req, res) => {
  const products = db
    .prepare(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      ORDER BY p.created_at DESC
    `)
    .all() as Record<string, unknown>[];

  const images = db.prepare('SELECT * FROM product_images ORDER BY sort_order ASC').all() as Record<string, unknown>[];
  const variants = db
    .prepare(`
      SELECT pv.*, inv.quantity_on_hand, inv.quantity_reserved, inv.low_stock_threshold
      FROM product_variants pv
      LEFT JOIN inventory inv ON inv.variant_id = pv.id
      ORDER BY pv.size ASC, pv.color ASC
    `)
    .all() as Record<string, unknown>[];

  res.json({
    products: products.map((p) => ({
      ...p,
      is_featured: Boolean(p.is_featured),
      is_bestseller: Boolean(p.is_bestseller),
      images: images.filter((i) => i.product_id === p.id),
      variants: variants.filter((v) => v.product_id === p.id),
    })),
  });
});

const productPayloadSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2),
  sku: z.string().min(2),
  category_id: z.string().nullable().optional(),
  description: z.string().default(''),
  regular_price_kobo: z.number().int().min(0),
  sale_price_kobo: z.number().int().min(0).nullable().optional(),
  is_featured: z.boolean().default(false),
  is_bestseller: z.boolean().default(false),
  status: z.enum(['draft', 'published', 'hidden']).default('draft'),
  low_stock_threshold: z.number().int().min(0).default(5),
  return_policy_override: z.string().nullable().optional(),
  images: z
    .array(
      z.object({
        url: z.string().min(1),
        alt_text: z.string().default(''),
        sort_order: z.number().int().default(0),
      })
    )
    .default([]),
  variants: z
    .array(
      z.object({
        id: z.string().optional(),
        sku: z.string().min(2),
        size: z.string().min(1),
        color: z.string().min(1),
        color_hex: z.string().default('#101820'),
        price_override_kobo: z.number().int().min(0).nullable().optional(),
        quantity_on_hand: z.number().int().min(0),
        low_stock_threshold: z.number().int().min(0).default(5),
      })
    )
    .min(1),
});

adminRouter.post('/products', requirePermission('products'), (req: AuthenticatedRequest, res) => {
  const parsed = productPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid product payload.' });
    return;
  }
  const d = parsed.data;
  const prodId = crypto.randomUUID();

  try {
    db.transaction(() => {
      db.prepare(`
        INSERT INTO products (
          id, category_id, name, slug, sku, description, regular_price_kobo, sale_price_kobo,
          is_featured, is_bestseller, status, low_stock_threshold, return_policy_override
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        prodId,
        d.category_id || null,
        d.name.trim(),
        d.slug.trim().toLowerCase(),
        d.sku.trim().toUpperCase(),
        d.description,
        d.regular_price_kobo,
        d.sale_price_kobo ?? null,
        d.is_featured ? 1 : 0,
        d.is_bestseller ? 1 : 0,
        d.status,
        d.low_stock_threshold,
        d.return_policy_override || null
      );

      const insImg = db.prepare(`
        INSERT INTO product_images (id, product_id, url, alt_text, sort_order) VALUES (?, ?, ?, ?, ?)
      `);
      d.images.forEach((img, idx) => {
        insImg.run(crypto.randomUUID(), prodId, img.url, img.alt_text || d.name, idx);
      });

      const insVar = db.prepare(`
        INSERT INTO product_variants (id, product_id, sku, size, color, color_hex, price_override_kobo, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
      `);
      const insInv = db.prepare(`
        INSERT INTO inventory (id, variant_id, quantity_on_hand, quantity_reserved, low_stock_threshold)
        VALUES (?, ?, ?, 0, ?)
      `);
      const insMove = db.prepare(`
        INSERT INTO inventory_movements (id, variant_id, delta, reason, reference_id, actor_id)
        VALUES (?, ?, ?, 'product_created', ?, ?)
      `);

      for (const v of d.variants) {
        const varId = crypto.randomUUID();
        insVar.run(
          varId,
          prodId,
          v.sku.trim().toUpperCase(),
          v.size.trim(),
          v.color.trim(),
          v.color_hex || '#101820',
          v.price_override_kobo ?? null
        );
        insInv.run(crypto.randomUUID(), varId, v.quantity_on_hand, v.low_stock_threshold ?? d.low_stock_threshold);
        insMove.run(crypto.randomUUID(), varId, v.quantity_on_hand, d.sku, req.authUser!.id);
      }
    })();

    logAdminActivity({
      actorId: req.authUser!.id,
      actorEmail: req.authUser!.email,
      action: 'product_created',
      entityType: 'product',
      entityId: prodId,
      details: { name: d.name, sku: d.sku, status: d.status },
      ipAddress: req.ip,
    });

    res.status(201).json({ id: prodId });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to create product.' });
  }
});

adminRouter.put('/products/:id', requirePermission('products'), (req: AuthenticatedRequest, res) => {
  const parsed = productPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid product update payload.' });
    return;
  }

  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id) as
    | Record<string, unknown>
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Product not found.' });
    return;
  }

  const d = parsed.data;
  try {
    db.transaction(() => {
      db.prepare(`
        UPDATE products SET
          category_id = ?, name = ?, slug = ?, sku = ?, description = ?,
          regular_price_kobo = ?, sale_price_kobo = ?, is_featured = ?, is_bestseller = ?,
          status = ?, low_stock_threshold = ?, return_policy_override = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(
        d.category_id || null,
        d.name.trim(),
        d.slug.trim().toLowerCase(),
        d.sku.trim().toUpperCase(),
        d.description,
        d.regular_price_kobo,
        d.sale_price_kobo ?? null,
        d.is_featured ? 1 : 0,
        d.is_bestseller ? 1 : 0,
        d.status,
        d.low_stock_threshold,
        d.return_policy_override || null,
        req.params.id
      );

      db.prepare('DELETE FROM product_images WHERE product_id = ?').run(req.params.id);
      const insImg = db.prepare(`
        INSERT INTO product_images (id, product_id, url, alt_text, sort_order) VALUES (?, ?, ?, ?, ?)
      `);
      d.images.forEach((img, idx) => {
        insImg.run(crypto.randomUUID(), req.params.id, img.url, img.alt_text || d.name, idx);
      });

      // Reconcile variants safely preserving existing variant IDs when matched
      const existingVariants = db
        .prepare('SELECT id FROM product_variants WHERE product_id = ?')
        .all(req.params.id) as { id: string }[];
      const incomingIds = new Set(d.variants.map((v) => v.id).filter(Boolean));

      for (const ev of existingVariants) {
        if (!incomingIds.has(ev.id)) {
          db.prepare('UPDATE product_variants SET is_active = 0 WHERE id = ?').run(ev.id);
        }
      }

      for (const v of d.variants) {
        if (v.id && existingVariants.some((e) => e.id === v.id)) {
          const prevInv = db.prepare('SELECT quantity_on_hand FROM inventory WHERE variant_id = ?').get(v.id) as
            | { quantity_on_hand: number }
            | undefined;

          db.prepare(`
            UPDATE product_variants SET sku = ?, size = ?, color = ?, color_hex = ?, price_override_kobo = ?, is_active = 1
            WHERE id = ?
          `).run(
            v.sku.trim().toUpperCase(),
            v.size.trim(),
            v.color.trim(),
            v.color_hex || '#101820',
            v.price_override_kobo ?? null,
            v.id
          );
          db.prepare(`
            UPDATE inventory SET quantity_on_hand = ?, low_stock_threshold = ?, updated_at = datetime('now')
            WHERE variant_id = ?
          `).run(v.quantity_on_hand, v.low_stock_threshold ?? d.low_stock_threshold, v.id);

          const diff = v.quantity_on_hand - (prevInv?.quantity_on_hand ?? 0);
          if (diff !== 0) {
            db.prepare(`
              INSERT INTO inventory_movements (id, variant_id, delta, reason, reference_id, actor_id)
              VALUES (?, ?, ?, 'admin_stock_adjustment', ?, ?)
            `).run(crypto.randomUUID(), v.id, diff, v.sku, req.authUser!.id);
          }
        } else {
          const varId = crypto.randomUUID();
          db.prepare(`
            INSERT INTO product_variants (id, product_id, sku, size, color, color_hex, price_override_kobo, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1)
          `).run(
            varId,
            req.params.id,
            v.sku.trim().toUpperCase(),
            v.size.trim(),
            v.color.trim(),
            v.color_hex || '#101820',
            v.price_override_kobo ?? null
          );
          db.prepare(`
            INSERT INTO inventory (id, variant_id, quantity_on_hand, quantity_reserved, low_stock_threshold)
            VALUES (?, ?, ?, 0, ?)
          `).run(crypto.randomUUID(), varId, v.quantity_on_hand, v.low_stock_threshold ?? d.low_stock_threshold);
          db.prepare(`
            INSERT INTO inventory_movements (id, variant_id, delta, reason, reference_id, actor_id)
            VALUES (?, ?, ?, 'variant_added', ?, ?)
          `).run(crypto.randomUUID(), varId, v.quantity_on_hand, v.sku, req.authUser!.id);
        }
      }
    })();

    logAdminActivity({
      actorId: req.authUser!.id,
      actorEmail: req.authUser!.email,
      action:
        existing.regular_price_kobo !== d.regular_price_kobo || existing.sale_price_kobo !== d.sale_price_kobo
          ? 'product_and_price_updated'
          : 'product_updated',
      entityType: 'product',
      entityId: req.params.id,
      details: { name: d.name, status: d.status },
      ipAddress: req.ip,
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to update product.' });
  }
});

adminRouter.delete('/products/:id', requirePermission('products'), (req: AuthenticatedRequest, res) => {
  const usedInOrders = db
    .prepare('SELECT COUNT(*) as c FROM order_items WHERE product_id = ?')
    .get(req.params.id) as { c: number };

  if (usedInOrders.c > 0) {
    // Safeguard: hide instead of hard-deleting products linked to historical orders
    db.prepare("UPDATE products SET status = 'hidden', updated_at = datetime('now') WHERE id = ?").run(req.params.id);
    logAdminActivity({
      actorId: req.authUser!.id,
      actorEmail: req.authUser!.email,
      action: 'product_archived_hidden',
      entityType: 'product',
      entityId: req.params.id,
      details: { reason: 'Referenced in historical orders' },
      ipAddress: req.ip,
    });
    res.json({ ok: true, archived: true, message: 'Product has historical orders and was safely hidden instead of deleted.' });
    return;
  }

  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  logAdminActivity({
    actorId: req.authUser!.id,
    actorEmail: req.authUser!.email,
    action: 'product_deleted',
    entityType: 'product',
    entityId: req.params.id,
    ipAddress: req.ip,
  });
  res.json({ ok: true, archived: false });
});

// ==================== CATEGORY MANAGEMENT ====================

adminRouter.get('/categories', requirePermission('categories'), (_req, res) => {
  const categories = db
    .prepare(`
      SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) as product_count
      FROM categories c
      ORDER BY c.display_order ASC, c.name ASC
    `)
    .all();
  res.json({ categories });
});

adminRouter.post('/categories', requirePermission('categories'), (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    name: z.string().min(2),
    slug: z.string().min(2),
    description: z.string().default(''),
    image_url: z.string().default(''),
    display_order: z.number().int().default(0),
    is_active: z.boolean().default(true),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid category fields.' });
    return;
  }

  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO categories (id, name, slug, description, image_url, display_order, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    parsed.data.name.trim(),
    parsed.data.slug.trim().toLowerCase(),
    parsed.data.description,
    parsed.data.image_url,
    parsed.data.display_order,
    parsed.data.is_active ? 1 : 0
  );

  logAdminActivity({
    actorId: req.authUser!.id,
    actorEmail: req.authUser!.email,
    action: 'category_created',
    entityType: 'category',
    entityId: id,
    details: { name: parsed.data.name },
    ipAddress: req.ip,
  });
  res.status(201).json({ id });
});

adminRouter.put('/categories/:id', requirePermission('categories'), (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    name: z.string().min(2),
    slug: z.string().min(2),
    description: z.string().default(''),
    image_url: z.string().default(''),
    display_order: z.number().int().default(0),
    is_active: z.boolean().default(true),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid category update fields.' });
    return;
  }

  db.prepare(`
    UPDATE categories SET name = ?, slug = ?, description = ?, image_url = ?, display_order = ?, is_active = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(
    parsed.data.name.trim(),
    parsed.data.slug.trim().toLowerCase(),
    parsed.data.description,
    parsed.data.image_url,
    parsed.data.display_order,
    parsed.data.is_active ? 1 : 0,
    req.params.id
  );

  logAdminActivity({
    actorId: req.authUser!.id,
    actorEmail: req.authUser!.email,
    action: 'category_updated',
    entityType: 'category',
    entityId: req.params.id,
    ipAddress: req.ip,
  });
  res.json({ ok: true });
});

adminRouter.delete('/categories/:id', requirePermission('categories'), (req: AuthenticatedRequest, res) => {
  const count = db.prepare('SELECT COUNT(*) as c FROM products WHERE category_id = ?').get(req.params.id) as {
    c: number;
  };
  if (count.c > 0) {
    res.status(400).json({ error: 'Cannot delete a category that still contains products. Reassign products first.' });
    return;
  }
  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  logAdminActivity({
    actorId: req.authUser!.id,
    actorEmail: req.authUser!.email,
    action: 'category_deleted',
    entityType: 'category',
    entityId: req.params.id,
    ipAddress: req.ip,
  });
  res.json({ ok: true });
});

// ==================== ORDERS MANAGEMENT ====================

adminRouter.get('/orders', requirePermission('orders'), (req, res) => {
  const search = String(req.query.search || '').trim().toLowerCase();
  const status = String(req.query.status || '').trim();

  let sql = `
    SELECT o.*, d.status as delivery_status, d.delivery_fee_kobo as assigned_delivery_fee_kobo, d.fee_payment_timing
    FROM orders o
    LEFT JOIN deliveries d ON d.order_id = o.id
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (search) {
    sql += ` AND (LOWER(o.order_number) LIKE ? OR LOWER(o.customer_name) LIKE ? OR LOWER(o.customer_email) LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (status) {
    sql += ` AND o.order_status = ?`;
    params.push(status);
  }
  sql += ` ORDER BY o.created_at DESC`;

  const orders = db.prepare(sql).all(...params) as Record<string, unknown>[];
  const orderIds = orders.map((o) => o.id as string);
  let items: Record<string, unknown>[] = [];
  if (orderIds.length > 0) {
    const ph = orderIds.map(() => '?').join(',');
    items = db.prepare(`SELECT * FROM order_items WHERE order_id IN (${ph})`).all(...orderIds) as Record<
      string,
      unknown
    >[];
  }

  res.json({
    orders: orders.map((o) => ({
      ...o,
      items: items.filter((i) => i.order_id === o.id),
    })),
  });
});

adminRouter.get('/orders/:id', requirePermission('orders'), (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
  if (!order) {
    res.status(404).json({ error: 'Order not found.' });
    return;
  }
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  const payments = db.prepare('SELECT * FROM payments WHERE order_id = ? ORDER BY created_at DESC').all(order.id);
  const delivery = db.prepare('SELECT * FROM deliveries WHERE order_id = ?').get(order.id);
  const history = db
    .prepare('SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at ASC')
    .all(order.id);
  res.json({ order, items, payments, delivery, history });
});

adminRouter.put('/orders/:id/status', requirePermission('orders'), (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    order_status: z.enum([
      'order_placed',
      'payment_confirmed',
      'processing',
      'ready_for_dispatch',
      'shipped',
      'out_for_delivery',
      'delivered',
      'cancelled',
      'payment_failed',
      'refunded',
    ]),
    cancellation_reason: z.string().optional(),
    note: z.string().optional(),
    internal_notes: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid order status update.' });
    return;
  }

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id) as
    | { id: string; order_number: string; customer_email: string; order_status: string; payment_method: string }
    | undefined;
  if (!order) {
    res.status(404).json({ error: 'Order not found.' });
    return;
  }

  db.transaction(() => {
    db.prepare(`
      UPDATE orders
      SET order_status = ?,
          cancellation_reason = COALESCE(?, cancellation_reason),
          internal_notes = COALESCE(?, internal_notes),
          updated_at = datetime('now')
      WHERE id = ?
    `).run(
      parsed.data.order_status,
      parsed.data.cancellation_reason || null,
      parsed.data.internal_notes ?? null,
      order.id
    );

    // Sync delivery status when relevant
    if (['ready_for_dispatch', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'].includes(parsed.data.order_status)) {
      db.prepare("UPDATE deliveries SET status = ?, updated_at = datetime('now') WHERE order_id = ?").run(
        parsed.data.order_status,
        order.id
      );
    }

    // Restore stock if cancelling a non-cancelled order
    if (parsed.data.order_status === 'cancelled' && order.order_status !== 'cancelled') {
      const items = db
        .prepare('SELECT variant_id, quantity FROM order_items WHERE order_id = ?')
        .all(order.id) as { variant_id: string | null; quantity: number }[];
      for (const item of items) {
        if (!item.variant_id) continue;
        db.prepare(`
          UPDATE inventory
          SET quantity_on_hand = quantity_on_hand + ?, updated_at = datetime('now')
          WHERE variant_id = ?
        `).run(item.quantity, item.variant_id);
        db.prepare(`
          INSERT INTO inventory_movements (id, variant_id, delta, reason, reference_id, actor_id)
          VALUES (?, ?, ?, 'order_cancelled_restock', ?, ?)
        `).run(crypto.randomUUID(), item.variant_id, item.quantity, order.order_number, req.authUser!.id);
      }
    }

    db.prepare(`
      INSERT INTO order_status_history (id, order_id, status, note, actor_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      order.id,
      parsed.data.order_status,
      parsed.data.note || parsed.data.cancellation_reason || `Updated to ${parsed.data.order_status}`,
      req.authUser!.id
    );
  })();

  logAdminActivity({
    actorId: req.authUser!.id,
    actorEmail: req.authUser!.email,
    action: 'order_status_updated',
    entityType: 'order',
    entityId: order.id,
    details: { order_number: order.order_number, new_status: parsed.data.order_status },
    ipAddress: req.ip,
  });

  createNotification({
    recipientType: 'customer',
    recipientEmail: order.customer_email,
    title: `Order Update — ${order.order_number}`,
    message: `Your order ${order.order_number} status is now: ${parsed.data.order_status.replace(/_/g, ' ')}.`,
    sendEmail: true,
  });

  res.json({ ok: true });
});

// ==================== PAYMENTS & SETTINGS ====================

adminRouter.get('/payments', requirePermission('payments'), (_req, res) => {
  const transactions = db
    .prepare(`
      SELECT p.*, o.order_number, o.customer_name, o.customer_email, o.order_status
      FROM payments p
      JOIN orders o ON o.id = p.order_id
      ORDER BY p.created_at DESC
    `)
    .all();

  const readiness = getPaymentReadiness();
  res.json({ transactions, readiness });
});

adminRouter.put('/payment-settings', requireSuperAdmin, (req: AuthenticatedRequest, res) => {
  const parsed = z
    .object({
      paystack: z.object({ enabled: z.boolean(), mode: z.enum(['test', 'live']), public_key: z.string().default('') }),
      flutterwave: z.object({ enabled: z.boolean(), mode: z.enum(['test', 'live']), public_key: z.string().default('') }),
      bank_transfer: z.object({
        enabled: z.boolean(),
        bank_name: z.string().default(''),
        account_name: z.string().default(''),
        account_number: z.string().default(''),
        instructions: z.string().default(''),
      }),
      cash_on_delivery: z.object({
        enabled: z.boolean(),
        instructions: z.string().default(''),
        requires_admin_approval: z.boolean().default(false),
      }),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payment configuration.' });
    return;
  }

  const current = getSetting<PaymentGatewaySettings>('payments')!;
  const updated: PaymentGatewaySettings = {
    paystack: { ...current.paystack, ...parsed.data.paystack },
    flutterwave: { ...current.flutterwave, ...parsed.data.flutterwave },
    bank_transfer: parsed.data.bank_transfer,
    cash_on_delivery: parsed.data.cash_on_delivery,
  };
  setSetting('payments', updated, req.authUser!.id);

  logAdminActivity({
    actorId: req.authUser!.id,
    actorEmail: req.authUser!.email,
    action: 'payment_settings_updated',
    entityType: 'store_settings',
    entityId: 'payments',
    ipAddress: req.ip,
  });

  res.json({ readiness: getPaymentReadiness() });
});

adminRouter.post('/payments/:id/verify-manual', requirePermission('payments'), (req: AuthenticatedRequest, res) => {
  const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id) as
    | { id: string; order_id: string; provider: string; status: string }
    | undefined;
  if (!payment) {
    res.status(404).json({ error: 'Payment transaction not found.' });
    return;
  }

  const order = db.prepare('SELECT order_number, customer_email FROM orders WHERE id = ?').get(payment.order_id) as {
    order_number: string;
    customer_email: string;
  };

  db.transaction(() => {
    db.prepare(`
      UPDATE payments
      SET status = 'successful', verified_by = ?, verified_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `).run(req.authUser!.id, payment.id);

    db.prepare(`
      UPDATE orders SET payment_status = 'paid', order_status = 'payment_confirmed', updated_at = datetime('now')
      WHERE id = ?
    `).run(payment.order_id);

    db.prepare(`
      INSERT INTO order_status_history (id, order_id, status, note, actor_id)
      VALUES (?, ?, 'payment_confirmed', 'Payment manually verified by staff.', ?)
    `).run(crypto.randomUUID(), payment.order_id, req.authUser!.id);
  })();

  logAdminActivity({
    actorId: req.authUser!.id,
    actorEmail: req.authUser!.email,
    action: 'manual_payment_verified',
    entityType: 'payment',
    entityId: payment.id,
    details: { order_number: order.order_number, provider: payment.provider },
    ipAddress: req.ip,
  });

  createNotification({
    recipientType: 'customer',
    recipientEmail: order.customer_email,
    title: `Payment Confirmed — ${order.order_number}`,
    message: `Your ${payment.provider.replace('_', ' ')} payment for order ${order.order_number} has been confirmed.`,
    sendEmail: true,
  });

  res.json({ ok: true });
});

// ==================== DELIVERIES MANAGEMENT ====================

adminRouter.get('/deliveries', requirePermission('deliveries'), (_req, res) => {
  const deliveries = db
    .prepare(`
      SELECT d.*, o.order_number, o.customer_name, o.customer_phone, o.country, o.state, o.city, o.delivery_address, o.order_status
      FROM deliveries d
      JOIN orders o ON o.id = d.order_id
      ORDER BY o.created_at DESC
    `)
    .all();
  res.json({ deliveries });
});

adminRouter.put('/deliveries/:orderId', requirePermission('deliveries'), (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    delivery_fee_kobo: z.number().int().min(0),
    fee_payment_timing: z.enum(['prepaid', 'pay_on_arrival']),
    courier_company: z.string().nullable().optional(),
    assigned_personnel: z.string().nullable().optional(),
    tracking_number: z.string().nullable().optional(),
    estimated_delivery_date: z.string().nullable().optional(),
    instructions: z.string().nullable().optional(),
    status: z.enum(['pending', 'ready_for_dispatch', 'shipped', 'out_for_delivery', 'delivered', 'cancelled']),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid delivery details.' });
    return;
  }

  const order = db.prepare('SELECT id, order_number, subtotal_kobo, discount_kobo, customer_email FROM orders WHERE id = ?').get(
    req.params.orderId
  ) as { id: string; order_number: string; subtotal_kobo: number; discount_kobo: number; customer_email: string } | undefined;
  if (!order) {
    res.status(404).json({ error: 'Order not found.' });
    return;
  }

  const d = parsed.data;
  const payableOnArrival = d.fee_payment_timing === 'pay_on_arrival' ? 1 : 0;
  const newTotal =
    Math.max(0, order.subtotal_kobo - order.discount_kobo) + (payableOnArrival ? 0 : d.delivery_fee_kobo);

  db.transaction(() => {
    db.prepare(`
      UPDATE deliveries
      SET delivery_fee_kobo = ?, fee_payment_timing = ?, courier_company = ?, assigned_personnel = ?,
          tracking_number = ?, estimated_delivery_date = ?, instructions = ?, status = ?, updated_at = datetime('now')
      WHERE order_id = ?
    `).run(
      d.delivery_fee_kobo,
      d.fee_payment_timing,
      d.courier_company || null,
      d.assigned_personnel || null,
      d.tracking_number || null,
      d.estimated_delivery_date || null,
      d.instructions || null,
      d.status,
      order.id
    );

    db.prepare(`
      UPDATE orders
      SET delivery_fee_kobo = ?, delivery_fee_payable_on_arrival = ?, total_kobo = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(d.delivery_fee_kobo, payableOnArrival, newTotal, order.id);

    if (['ready_for_dispatch', 'shipped', 'out_for_delivery', 'delivered'].includes(d.status)) {
      db.prepare("UPDATE orders SET order_status = ?, updated_at = datetime('now') WHERE id = ?").run(d.status, order.id);
      db.prepare(`
        INSERT INTO order_status_history (id, order_id, status, note, actor_id)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        crypto.randomUUID(),
        order.id,
        d.status,
        d.tracking_number ? `Delivery ${d.status} (Tracking: ${d.tracking_number})` : `Delivery status: ${d.status}`,
        req.authUser!.id
      );
    }
  })();

  logAdminActivity({
    actorId: req.authUser!.id,
    actorEmail: req.authUser!.email,
    action: 'delivery_updated',
    entityType: 'delivery',
    entityId: order.id,
    details: { order_number: order.order_number, fee_kobo: d.delivery_fee_kobo, status: d.status },
    ipAddress: req.ip,
  });

  createNotification({
    recipientType: 'customer',
    recipientEmail: order.customer_email,
    title: `Delivery Update — ${order.order_number}`,
    message: `Delivery status for order ${order.order_number} is now ${d.status.replace(/_/g, ' ')}.${
      d.tracking_number ? ` Tracking reference: ${d.tracking_number}.` : ''
    }`,
    sendEmail: true,
  });

  res.json({ ok: true });
});

// ==================== CUSTOMERS MANAGEMENT ====================

adminRouter.get('/customers', requirePermission('customers'), (req, res) => {
  const search = String(req.query.search || '').trim().toLowerCase();
  let sql = `
    SELECT c.*,
      (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id OR LOWER(o.customer_email) = LOWER(c.email)) as order_count,
      (SELECT COALESCE(SUM(o.total_kobo), 0) FROM orders o WHERE (o.customer_id = c.id OR LOWER(o.customer_email) = LOWER(c.email)) AND o.payment_status = 'paid') as total_spent_kobo
    FROM customers c
    WHERE 1=1
  `;
  const params: unknown[] = [];
  if (search) {
    sql += ` AND (LOWER(c.full_name) LIKE ? OR LOWER(c.email) LIKE ? OR LOWER(COALESCE(c.phone,'')) LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  sql += ` ORDER BY c.created_at DESC`;
  res.json({ customers: db.prepare(sql).all(...params) });
});

adminRouter.put('/customers/:id/status', requirePermission('customers'), (req: AuthenticatedRequest, res) => {
  const schema = z.object({ status: z.enum(['active', 'suspended']) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid status.' });
    return;
  }
  db.prepare("UPDATE customers SET status = ?, updated_at = datetime('now') WHERE id = ?").run(
    parsed.data.status,
    req.params.id
  );
  logAdminActivity({
    actorId: req.authUser!.id,
    actorEmail: req.authUser!.email,
    action: `customer_${parsed.data.status}`,
    entityType: 'customer',
    entityId: req.params.id,
    ipAddress: req.ip,
  });
  res.json({ ok: true });
});

// ==================== COUPONS MANAGEMENT ====================

adminRouter.get('/coupons', requirePermission('coupons'), (_req, res) => {
  const coupons = db.prepare('SELECT * FROM coupons ORDER BY created_at DESC').all();
  res.json({ coupons });
});

adminRouter.post('/coupons', requirePermission('coupons'), (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    code: z.string().min(2),
    discount_type: z.enum(['percentage', 'fixed']),
    discount_value: z.number().int().min(1),
    min_purchase_kobo: z.number().int().min(0).default(0),
    max_discount_kobo: z.number().int().min(0).nullable().optional(),
    usage_limit: z.number().int().min(1).nullable().optional(),
    per_customer_limit: z.number().int().min(1).default(1),
    starts_at: z.string().nullable().optional(),
    expires_at: z.string().nullable().optional(),
    is_active: z.boolean().default(true),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid coupon details.' });
    return;
  }

  const d = parsed.data;
  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO coupons (id, code, discount_type, discount_value, min_purchase_kobo, max_discount_kobo, usage_limit, per_customer_limit, starts_at, expires_at, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    d.code.trim().toUpperCase(),
    d.discount_type,
    d.discount_value,
    d.min_purchase_kobo,
    d.max_discount_kobo ?? null,
    d.usage_limit ?? null,
    d.per_customer_limit,
    d.starts_at || null,
    d.expires_at || null,
    d.is_active ? 1 : 0
  );

  logAdminActivity({
    actorId: req.authUser!.id,
    actorEmail: req.authUser!.email,
    action: 'coupon_created',
    entityType: 'coupon',
    entityId: id,
    details: { code: d.code.toUpperCase() },
    ipAddress: req.ip,
  });
  res.status(201).json({ id });
});

adminRouter.put('/coupons/:id', requirePermission('coupons'), (req: AuthenticatedRequest, res) => {
  const schema = z.object({ is_active: z.boolean() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid coupon status.' });
    return;
  }
  db.prepare('UPDATE coupons SET is_active = ? WHERE id = ?').run(parsed.data.is_active ? 1 : 0, req.params.id);
  res.json({ ok: true });
});

adminRouter.delete('/coupons/:id', requirePermission('coupons'), (req: AuthenticatedRequest, res) => {
  db.prepare('DELETE FROM coupons WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ==================== RETURNS & REFUNDS ====================

adminRouter.get('/returns', requirePermission('returns'), (_req, res) => {
  const returns = db
    .prepare(`
      SELECT r.*, o.order_number, o.total_kobo
      FROM returns r
      JOIN orders o ON o.id = r.order_id
      ORDER BY r.created_at DESC
    `)
    .all();
  const refunds = db
    .prepare(`
      SELECT rf.*, o.order_number
      FROM refunds rf
      JOIN orders o ON o.id = rf.order_id
      ORDER BY rf.created_at DESC
    `)
    .all();
  const settings = getSetting('returns');
  res.json({ returns, refunds, settings });
});

adminRouter.put('/returns-settings', requireSuperAdmin, (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    enabled: z.boolean(),
    deadline_days: z.number().int().min(0),
    conditions: z.string(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid return policy settings.' });
    return;
  }
  setSetting('returns', parsed.data, req.authUser!.id);
  logAdminActivity({
    actorId: req.authUser!.id,
    actorEmail: req.authUser!.email,
    action: 'returns_policy_updated',
    entityType: 'store_settings',
    entityId: 'returns',
    ipAddress: req.ip,
  });
  res.json({ ok: true });
});

// ==================== REPORTS & ANALYTICS ====================

adminRouter.get('/reports', requirePermission('reports'), (req, res) => {
  const period = String(req.query.period || 'monthly');
  let cutoffSql = "datetime('now', '-30 days')";
  if (period === 'daily') cutoffSql = "datetime('now', '-1 day')";
  if (period === 'weekly') cutoffSql = "datetime('now', '-7 days')";
  if (period === 'yearly') cutoffSql = "datetime('now', '-365 days')";

  const financial = db
    .prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN order_status != 'cancelled' THEN total_kobo ELSE 0 END), 0) as gross_order_value_kobo,
        COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total_kobo ELSE 0 END), 0) as collected_payments_kobo,
        COALESCE(SUM(CASE WHEN order_status != 'cancelled' THEN delivery_fee_kobo ELSE 0 END), 0) as delivery_charges_kobo,
        COUNT(*) as total_orders,
        SUM(CASE WHEN order_status = 'delivered' THEN 1 ELSE 0 END) as completed_orders,
        SUM(CASE WHEN order_status IN ('order_placed', 'payment_confirmed', 'processing', 'ready_for_dispatch', 'shipped', 'out_for_delivery') THEN 1 ELSE 0 END) as pending_orders,
        SUM(CASE WHEN order_status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_orders
      FROM orders
      WHERE created_at >= ${cutoffSql}
    `)
    .get() as Record<string, number>;

  const refundsTotal = db
    .prepare(`SELECT COALESCE(SUM(amount_kobo), 0) as total FROM refunds WHERE status = 'processed' AND created_at >= ${cutoffSql}`)
    .get() as { total: number };

  const inventoryPerformance = db
    .prepare(`
      SELECT p.name, pv.sku, pv.size, pv.color, inv.quantity_on_hand, inv.quantity_reserved,
             MAX(0, inv.quantity_on_hand - inv.quantity_reserved) as available
      FROM product_variants pv
      JOIN products p ON p.id = pv.product_id
      JOIN inventory inv ON inv.variant_id = pv.id
      WHERE pv.is_active = 1
      ORDER BY available ASC
    `)
    .all();

  const ordersExport = db
    .prepare(`
      SELECT order_number, customer_name, customer_email, country, state, subtotal_kobo, discount_kobo, delivery_fee_kobo, total_kobo, payment_method, payment_status, order_status, created_at
      FROM orders
      WHERE created_at >= ${cutoffSql}
      ORDER BY created_at DESC
    `)
    .all();

  res.json({
    period,
    financial: {
      ...financial,
      refunds_kobo: refundsTotal.total || 0,
    },
    inventory_performance: inventoryPerformance,
    orders: ordersExport,
  });
});

// ==================== CONTENT CMS MANAGEMENT ====================

adminRouter.get('/content', requirePermission('content'), (_req, res) => {
  const rows = db.prepare('SELECT key, title, body, updated_at FROM content').all() as {
    key: string;
    title: string;
    body: string;
    updated_at: string;
  }[];
  const mapped: Record<string, { title: string; body: unknown; updated_at: string }> = {};
  for (const r of rows) {
    mapped[r.key] = { title: r.title, body: JSON.parse(r.body), updated_at: r.updated_at };
  }
  res.json({ content: mapped });
});

adminRouter.put('/content/:key', requirePermission('content'), (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    title: z.string().min(1),
    body: z.unknown(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid content payload.' });
    return;
  }

  db.prepare(`
    INSERT INTO content (key, title, body, updated_by, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET title = excluded.title, body = excluded.body, updated_by = excluded.updated_by, updated_at = datetime('now')
  `).run(req.params.key, parsed.data.title, JSON.stringify(parsed.data.body), req.authUser!.id);

  logAdminActivity({
    actorId: req.authUser!.id,
    actorEmail: req.authUser!.email,
    action: 'website_content_updated',
    entityType: 'content',
    entityId: req.params.key,
    ipAddress: req.ip,
  });
  res.json({ ok: true });
});

// ==================== STAFF MANAGEMENT (SUPER ADMIN ONLY) ====================

adminRouter.get('/staff', requireSuperAdmin, (_req, res) => {
  const placeholders = STAFF_ROLES.map(() => '?').join(',');
  const staff = db
    .prepare(`
      SELECT id, email, full_name, phone, role, is_active, created_at
      FROM profiles
      WHERE role IN (${placeholders})
      ORDER BY created_at ASC
    `)
    .all(...STAFF_ROLES) as Record<string, unknown>[];

  const perms = db.prepare('SELECT profile_id, permission FROM staff_permissions').all() as {
    profile_id: string;
    permission: Permission;
  }[];

  res.json({
    staff: staff.map((s) => ({
      ...s,
      is_active: Boolean(s.is_active),
      permissions:
        s.role === 'super_admin'
          ? [...ALL_PERMISSIONS]
          : perms.filter((p) => p.profile_id === s.id).map((p) => p.permission),
    })),
    available_roles: STAFF_ROLES,
    available_permissions: ALL_PERMISSIONS,
    default_role_permissions: DEFAULT_ROLE_PERMISSIONS,
  });
});

adminRouter.post('/staff', requireSuperAdmin, (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    full_name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(10),
    role: z.enum(['super_admin', 'store_manager', 'product_manager', 'order_manager', 'content_manager']),
    permissions: z.array(z.string()).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid staff details.' });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const exists = db.prepare('SELECT id FROM profiles WHERE LOWER(email) = ?').get(email);
  if (exists) {
    res.status(409).json({ error: 'A user with this email already exists.' });
    return;
  }

  const id = crypto.randomUUID();
  const role = parsed.data.role as StaffRole;
  const perms = parsed.data.permissions?.length
    ? parsed.data.permissions
    : DEFAULT_ROLE_PERMISSIONS[role];

  db.transaction(() => {
    db.prepare(`
      INSERT INTO profiles (id, email, password_hash, full_name, role, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
    `).run(id, email, hashPassword(parsed.data.password), parsed.data.full_name.trim(), role);

    const insPerm = db.prepare('INSERT INTO staff_permissions (id, profile_id, permission) VALUES (?, ?, ?)');
    for (const p of perms) {
      if ((ALL_PERMISSIONS as readonly string[]).includes(p)) {
        insPerm.run(crypto.randomUUID(), id, p);
      }
    }
  })();

  logAdminActivity({
    actorId: req.authUser!.id,
    actorEmail: req.authUser!.email,
    action: 'staff_created',
    entityType: 'profile',
    entityId: id,
    details: { email, role },
    ipAddress: req.ip,
  });

  res.status(201).json({ id });
});

adminRouter.put('/staff/:id', requireSuperAdmin, (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    full_name: z.string().min(2).optional(),
    role: z.enum(['super_admin', 'store_manager', 'product_manager', 'order_manager', 'content_manager']).optional(),
    is_active: z.boolean().optional(),
    permissions: z.array(z.string()).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid staff update payload.' });
    return;
  }

  if (req.params.id === req.authUser!.id && parsed.data.is_active === false) {
    res.status(400).json({ error: 'You cannot deactivate your own Super Admin account.' });
    return;
  }

  db.transaction(() => {
    if (parsed.data.full_name !== undefined) {
      db.prepare('UPDATE profiles SET full_name = ?, updated_at = datetime(\'now\') WHERE id = ?').run(
        parsed.data.full_name.trim(),
        req.params.id
      );
    }
    if (parsed.data.role !== undefined) {
      db.prepare('UPDATE profiles SET role = ?, updated_at = datetime(\'now\') WHERE id = ?').run(
        parsed.data.role,
        req.params.id
      );
    }
    if (parsed.data.is_active !== undefined) {
      db.prepare('UPDATE profiles SET is_active = ?, updated_at = datetime(\'now\') WHERE id = ?').run(
        parsed.data.is_active ? 1 : 0,
        req.params.id
      );
      if (!parsed.data.is_active) {
        db.prepare('DELETE FROM sessions WHERE profile_id = ?').run(req.params.id);
      }
    }
    if (parsed.data.permissions !== undefined) {
      db.prepare('DELETE FROM staff_permissions WHERE profile_id = ?').run(req.params.id);
      const insPerm = db.prepare('INSERT INTO staff_permissions (id, profile_id, permission) VALUES (?, ?, ?)');
      for (const p of parsed.data.permissions) {
        if ((ALL_PERMISSIONS as readonly string[]).includes(p)) {
          insPerm.run(crypto.randomUUID(), req.params.id, p);
        }
      }
    }
  })();

  logAdminActivity({
    actorId: req.authUser!.id,
    actorEmail: req.authUser!.email,
    action: 'staff_updated',
    entityType: 'profile',
    entityId: req.params.id,
    details: parsed.data as Record<string, unknown>,
    ipAddress: req.ip,
  });
  res.json({ ok: true });
});

// ==================== STORE SETTINGS, LOGS & NOTIFICATIONS ====================

adminRouter.get('/settings', requirePermission('settings'), (_req, res) => {
  const rows = db.prepare('SELECT key, value FROM store_settings').all() as { key: string; value: string }[];
  const settings: Record<string, unknown> = {};
  for (const r of rows) {
    settings[r.key] = JSON.parse(r.value);
  }
  res.json({ settings });
});

adminRouter.put('/settings', requireSuperAdmin, (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    general: z.record(z.string(), z.unknown()).optional(),
    delivery: z.record(z.string(), z.unknown()).optional(),
    stock: z.record(z.string(), z.unknown()).optional(),
    orders: z.record(z.string(), z.unknown()).optional(),
    notifications: z.record(z.string(), z.unknown()).optional(),
    returns: z.record(z.string(), z.unknown()).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid settings payload.' });
    return;
  }

  for (const [key, val] of Object.entries(parsed.data)) {
    if (val !== undefined) {
      setSetting(key, val, req.authUser!.id);
    }
  }

  logAdminActivity({
    actorId: req.authUser!.id,
    actorEmail: req.authUser!.email,
    action: 'store_settings_updated',
    entityType: 'store_settings',
    details: { keys: Object.keys(parsed.data) },
    ipAddress: req.ip,
  });

  res.json({ ok: true });
});

adminRouter.get('/activity-logs', requirePermission('activity_logs'), (req, res) => {
  const limit = Math.min(200, Number(req.query.limit || 100));
  const logs = db
    .prepare('SELECT * FROM admin_activity_logs ORDER BY created_at DESC LIMIT ?')
    .all(limit);
  res.json({ logs });
});

adminRouter.get('/notifications', (_req, res) => {
  const notifications = db
    .prepare("SELECT * FROM notifications WHERE recipient_type = 'admin' ORDER BY created_at DESC LIMIT 40")
    .all();
  res.json({ notifications });
});

adminRouter.post('/notifications/mark-read', (_req, res) => {
  db.prepare("UPDATE notifications SET is_read = 1 WHERE recipient_type = 'admin'").run();
  res.json({ ok: true });
});
