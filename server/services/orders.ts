import crypto from 'crypto';
import { db, getSetting } from '../db';
import { createNotification } from './notifications';

export function releaseExpiredReservations() {
  const nowIso = new Date().toISOString();
  const expiredOrders = db
    .prepare(`
      SELECT id, order_number FROM orders
      WHERE payment_method IN ('paystack', 'flutterwave')
        AND payment_status = 'pending'
        AND order_status = 'order_placed'
        AND reservation_expires_at IS NOT NULL
        AND reservation_expires_at < ?
    `)
    .all(nowIso) as { id: string; order_number: string }[];

  if (expiredOrders.length === 0) return;

  const tx = db.transaction(() => {
    for (const ord of expiredOrders) {
      const items = db
        .prepare('SELECT variant_id, quantity FROM order_items WHERE order_id = ?')
        .all(ord.id) as { variant_id: string | null; quantity: number }[];
      for (const item of items) {
        if (!item.variant_id) continue;
        db.prepare(`
          UPDATE inventory
          SET quantity_reserved = MAX(0, quantity_reserved - ?), updated_at = datetime('now')
          WHERE variant_id = ?
        `).run(item.quantity, item.variant_id);
        db.prepare(`
          INSERT INTO inventory_movements (id, variant_id, delta, reason, reference_id)
          VALUES (?, ?, ?, 'reservation_expired', ?)
        `).run(crypto.randomUUID(), item.variant_id, item.quantity, ord.order_number);
      }
      db.prepare(`
        UPDATE orders
        SET order_status = 'cancelled', cancellation_reason = 'Unpaid online payment reservation expired', updated_at = datetime('now')
        WHERE id = ?
      `).run(ord.id);
      db.prepare(`
        INSERT INTO order_status_history (id, order_id, status, note)
        VALUES (?, ?, 'cancelled', 'Automatic cancellation after unpaid online reservation expired.')
      `).run(crypto.randomUUID(), ord.id);
    }
  });

  tx();
}

export function validateCouponForSubtotal(code: string, subtotalKobo: number, customerEmail?: string) {
  const normalized = code.trim().toUpperCase();
  const coupon = db.prepare('SELECT * FROM coupons WHERE UPPER(code) = ?').get(normalized) as
    | {
        id: string;
        code: string;
        discount_type: 'percentage' | 'fixed';
        discount_value: number;
        min_purchase_kobo: number;
        max_discount_kobo: number | null;
        usage_limit: number | null;
        per_customer_limit: number;
        used_count: number;
        starts_at: string | null;
        expires_at: string | null;
        is_active: number;
      }
    | undefined;

  if (!coupon || !coupon.is_active) {
    return { valid: false as const, error: 'Coupon code is invalid or inactive.' };
  }

  const now = Date.now();
  if (coupon.starts_at && new Date(coupon.starts_at).getTime() > now) {
    return { valid: false as const, error: 'This coupon is not active yet.' };
  }
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() < now) {
    return { valid: false as const, error: 'This coupon has expired.' };
  }
  if (subtotalKobo < coupon.min_purchase_kobo) {
    return {
      valid: false as const,
      error: `Minimum purchase of ₦${(coupon.min_purchase_kobo / 100).toLocaleString()} required for this coupon.`,
    };
  }
  if (coupon.usage_limit !== null && coupon.used_count >= coupon.usage_limit) {
    return { valid: false as const, error: 'This coupon has reached its maximum usage limit.' };
  }
  if (customerEmail) {
    const userCount = db
      .prepare('SELECT COUNT(*) as c FROM coupon_usage WHERE coupon_id = ? AND LOWER(customer_email) = ?')
      .get(coupon.id, customerEmail.toLowerCase()) as { c: number };
    if (userCount.c >= coupon.per_customer_limit) {
      return { valid: false as const, error: 'You have already used this coupon the maximum number of times.' };
    }
  }

  let discountKobo =
    coupon.discount_type === 'percentage'
      ? Math.round((subtotalKobo * coupon.discount_value) / 100)
      : coupon.discount_value;

  if (coupon.max_discount_kobo !== null && discountKobo > coupon.max_discount_kobo) {
    discountKobo = coupon.max_discount_kobo;
  }
  if (discountKobo > subtotalKobo) {
    discountKobo = subtotalKobo;
  }

  return {
    valid: true as const,
    coupon,
    discount_kobo: discountKobo,
  };
}

export interface CreateOrderInput {
  idempotencyKey?: string;
  customerProfileId?: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerWhatsapp?: string;
  country: string;
  state: string;
  city: string;
  deliveryAddress: string;
  postalCode?: string;
  deliveryInstructions?: string;
  paymentMethod: 'paystack' | 'flutterwave' | 'bank_transfer' | 'cash_on_delivery';
  couponCode?: string;
  items: { variantId: string; quantity: number }[];
}

export function generateUniqueOrderNumber(): string {
  const settings = getSetting<{ order_prefix?: string }>('orders');
  const prefix = settings?.order_prefix || 'DS';
  const datePart = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${datePart}-${rand}`;
}

export function createOrderAtomic(input: CreateOrderInput) {
  releaseExpiredReservations();

  // Idempotency protection against duplicate submissions
  if (input.idempotencyKey) {
    const existingOrder = db
      .prepare('SELECT * FROM orders WHERE idempotency_key = ?')
      .get(input.idempotencyKey) as Record<string, unknown> | undefined;
    if (existingOrder) {
      return { order: existingOrder, duplicate: true as const };
    }
  }

  if (!input.items || input.items.length === 0) {
    throw new Error('Cannot create an order with an empty cart.');
  }

  const deliverySettings = getSetting<{
    default_fee_kobo?: number;
    default_payable_on_arrival?: boolean;
  }>('delivery');
  const stockSettings = getSetting<{ reservation_minutes?: number }>('stock');

  const isOnlineGateway = input.paymentMethod === 'paystack' || input.paymentMethod === 'flutterwave';
  const reservationMinutes = stockSettings?.reservation_minutes ?? 30;
  const reservationExpiresAt = isOnlineGateway
    ? new Date(Date.now() + reservationMinutes * 60 * 1000).toISOString()
    : null;

  const orderId = crypto.randomUUID();
  const orderNumber = generateUniqueOrderNumber();
  const paymentReference = `PAY-${orderNumber}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

  const result = db.transaction(() => {
    // Upsert customer record
    let customerId: string | null = null;
    if (input.customerProfileId) {
      const cust = db
        .prepare('SELECT id FROM customers WHERE profile_id = ?')
        .get(input.customerProfileId) as { id: string } | undefined;
      customerId = cust?.id ?? null;
    }
    if (!customerId) {
      const byEmail = db
        .prepare('SELECT id FROM customers WHERE LOWER(email) = ?')
        .get(input.customerEmail.toLowerCase()) as { id: string } | undefined;
      if (byEmail) {
        customerId = byEmail.id;
      } else {
        customerId = crypto.randomUUID();
        db.prepare(`
          INSERT INTO customers (id, profile_id, email, full_name, phone, whatsapp_number)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          customerId,
          input.customerProfileId ?? null,
          input.customerEmail.toLowerCase(),
          input.customerName,
          input.customerPhone,
          input.customerWhatsapp ?? null
        );
      }
    }

    // Recompute prices from DB and check variant stock atomically
    let subtotalKobo = 0;
    const resolvedItems: {
      productId: string;
      variantId: string;
      productName: string;
      variantSku: string;
      size: string;
      color: string;
      unitPriceKobo: number;
      quantity: number;
      lineTotalKobo: number;
      lowStockThreshold: number;
      remainingAfter: number;
    }[] = [];

    for (const reqItem of input.items) {
      const qty = Math.floor(Number(reqItem.quantity));
      if (!Number.isFinite(qty) || qty <= 0) {
        throw new Error('Invalid item quantity requested.');
      }

      const row = db
        .prepare(`
          SELECT
            pv.id as variant_id, pv.sku as variant_sku, pv.size, pv.color, pv.price_override_kobo, pv.is_active as variant_active,
            p.id as product_id, p.name as product_name, p.regular_price_kobo, p.sale_price_kobo, p.status as product_status, p.low_stock_threshold,
            inv.quantity_on_hand, inv.quantity_reserved
          FROM product_variants pv
          JOIN products p ON p.id = pv.product_id
          JOIN inventory inv ON inv.variant_id = pv.id
          WHERE pv.id = ?
        `)
        .get(reqItem.variantId) as
        | {
            variant_id: string;
            variant_sku: string;
            size: string;
            color: string;
            price_override_kobo: number | null;
            variant_active: number;
            product_id: string;
            product_name: string;
            regular_price_kobo: number;
            sale_price_kobo: number | null;
            product_status: string;
            low_stock_threshold: number;
            quantity_on_hand: number;
            quantity_reserved: number;
          }
        | undefined;

      if (!row || !row.variant_active || row.product_status !== 'published') {
        throw new Error('One or more selected products are no longer available.');
      }

      const available = row.quantity_on_hand - row.quantity_reserved;
      if (available < qty) {
        throw new Error(
          `Insufficient stock for ${row.product_name} (${row.color}, ${row.size}). Only ${Math.max(0, available)} left.`
        );
      }

      const unitPriceKobo =
        row.price_override_kobo ?? row.sale_price_kobo ?? row.regular_price_kobo;
      const lineTotalKobo = unitPriceKobo * qty;
      subtotalKobo += lineTotalKobo;

      if (isOnlineGateway) {
        // Reserve inventory until online payment verifies or expires
        db.prepare(`
          UPDATE inventory SET quantity_reserved = quantity_reserved + ?, updated_at = datetime('now')
          WHERE variant_id = ?
        `).run(qty, row.variant_id);
        db.prepare(`
          INSERT INTO inventory_movements (id, variant_id, delta, reason, reference_id)
          VALUES (?, ?, ?, 'order_reserved', ?)
        `).run(crypto.randomUUID(), row.variant_id, -qty, orderNumber);
      } else {
        // Bank transfer / COD deducts available stock immediately
        db.prepare(`
          UPDATE inventory SET quantity_on_hand = quantity_on_hand - ?, updated_at = datetime('now')
          WHERE variant_id = ?
        `).run(qty, row.variant_id);
        db.prepare(`
          INSERT INTO inventory_movements (id, variant_id, delta, reason, reference_id)
          VALUES (?, ?, ?, 'order_placed_deduction', ?)
        `).run(crypto.randomUUID(), row.variant_id, -qty, orderNumber);
      }

      resolvedItems.push({
        productId: row.product_id,
        variantId: row.variant_id,
        productName: row.product_name,
        variantSku: row.variant_sku,
        size: row.size,
        color: row.color,
        unitPriceKobo,
        quantity: qty,
        lineTotalKobo,
        lowStockThreshold: row.low_stock_threshold,
        remainingAfter: available - qty,
      });
    }

    // Coupon validation
    let discountKobo = 0;
    let appliedCouponCode: string | null = null;
    let appliedCouponId: string | null = null;
    if (input.couponCode && input.couponCode.trim()) {
      const couponCheck = validateCouponForSubtotal(input.couponCode, subtotalKobo, input.customerEmail);
      if (!couponCheck.valid) {
        throw new Error(couponCheck.error);
      }
      discountKobo = couponCheck.discount_kobo;
      appliedCouponCode = couponCheck.coupon.code;
      appliedCouponId = couponCheck.coupon.id;
    }

    // Delivery arrangement (default: fee confirmed per order & payable on delivery day)
    const deliveryFeeKobo = deliverySettings?.default_fee_kobo ?? 0;
    const deliveryPayableOnArrival = deliverySettings?.default_payable_on_arrival !== false ? 1 : 0;
    const totalPayableNowKobo =
      Math.max(0, subtotalKobo - discountKobo) + (deliveryPayableOnArrival ? 0 : deliveryFeeKobo);

    const paymentStatus = input.paymentMethod === 'bank_transfer' ? 'awaiting_verification' : 'pending';

    db.prepare(`
      INSERT INTO orders (
        id, order_number, idempotency_key, customer_id,
        customer_name, customer_email, customer_phone, customer_whatsapp,
        country, state, city, delivery_address, postal_code, delivery_instructions,
        currency, subtotal_kobo, discount_kobo, delivery_fee_kobo, delivery_fee_payable_on_arrival,
        total_kobo, coupon_code, payment_method, payment_status, order_status, reservation_expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'NGN', ?, ?, ?, ?, ?, ?, ?, ?, 'order_placed', ?)
    `).run(
      orderId,
      orderNumber,
      input.idempotencyKey ?? null,
      customerId,
      input.customerName.trim(),
      input.customerEmail.trim().toLowerCase(),
      input.customerPhone.trim(),
      input.customerWhatsapp?.trim() || null,
      input.country.trim(),
      input.state.trim(),
      input.city.trim(),
      input.deliveryAddress.trim(),
      input.postalCode?.trim() || null,
      input.deliveryInstructions?.trim() || null,
      subtotalKobo,
      discountKobo,
      deliveryFeeKobo,
      deliveryPayableOnArrival,
      totalPayableNowKobo,
      appliedCouponCode,
      input.paymentMethod,
      paymentStatus,
      reservationExpiresAt
    );

    const insertItem = db.prepare(`
      INSERT INTO order_items (id, order_id, product_id, variant_id, product_name, variant_sku, size, color, unit_price_kobo, quantity, line_total_kobo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const it of resolvedItems) {
      insertItem.run(
        crypto.randomUUID(),
        orderId,
        it.productId,
        it.variantId,
        it.productName,
        it.variantSku,
        it.size,
        it.color,
        it.unitPriceKobo,
        it.quantity,
        it.lineTotalKobo
      );
    }

    if (appliedCouponId) {
      db.prepare('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?').run(appliedCouponId);
      db.prepare(`
        INSERT INTO coupon_usage (id, coupon_id, order_id, customer_email, discount_applied_kobo)
        VALUES (?, ?, ?, ?, ?)
      `).run(crypto.randomUUID(), appliedCouponId, orderId, input.customerEmail.toLowerCase(), discountKobo);
    }

    db.prepare(`
      INSERT INTO payments (id, order_id, provider, reference, amount_kobo, currency, status)
      VALUES (?, ?, ?, ?, ?, 'NGN', ?)
    `).run(crypto.randomUUID(), orderId, input.paymentMethod, paymentReference, totalPayableNowKobo, paymentStatus);

    const deliveryScope = input.country.trim().toLowerCase() === 'nigeria' ? 'nigeria' : 'international';
    db.prepare(`
      INSERT INTO deliveries (id, order_id, delivery_fee_kobo, fee_payment_timing, delivery_scope, instructions, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `).run(
      crypto.randomUUID(),
      orderId,
      deliveryFeeKobo,
      deliveryPayableOnArrival ? 'pay_on_arrival' : 'prepaid',
      deliveryScope,
      input.deliveryInstructions?.trim() || null
    );

    db.prepare(`
      INSERT INTO order_status_history (id, order_id, status, note)
      VALUES (?, ?, 'order_placed', 'Order submitted by customer.')
    `).run(crypto.randomUUID(), orderId);

    const createdOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as Record<string, unknown>;
    return { order: createdOrder, duplicate: false as const, paymentReference, resolvedItems };
  });

  const outcome = result();

  if (!outcome.duplicate && 'resolvedItems' in outcome) {
    createNotification({
      recipientType: 'admin',
      title: `New Order · ${orderNumber}`,
      message: `${input.customerName} placed order ${orderNumber} (${input.paymentMethod.replace('_', ' ')}).`,
    });

    createNotification({
      recipientType: 'customer',
      recipientEmail: input.customerEmail,
      title: `Diamond Store Order Confirmation — ${orderNumber}`,
      message: `Thank you for your order ${orderNumber}. You can track your order progress at any time using your order number.`,
      sendEmail: true,
    });

    for (const item of outcome.resolvedItems) {
      if (item.remainingAfter <= item.lowStockThreshold) {
        createNotification({
          recipientType: 'admin',
          title: `Low Stock Warning · ${item.variantSku}`,
          message: `${item.productName} (${item.color} / ${item.size}) has ${item.remainingAfter} units remaining.`,
        });
      }
    }
  }

  return outcome;
}
