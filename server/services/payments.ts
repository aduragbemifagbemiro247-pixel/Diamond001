import crypto from 'crypto';
import { db, getSetting } from '../db';
import { createNotification } from './notifications';

export interface PaymentGatewaySettings {
  paystack: {
    enabled: boolean;
    mode: 'test' | 'live';
    public_key: string;
    webhook_url: string;
  };
  flutterwave: {
    enabled: boolean;
    mode: 'test' | 'live';
    public_key: string;
    webhook_url: string;
  };
  bank_transfer: {
    enabled: boolean;
    bank_name: string;
    account_name: string;
    account_number: string;
    instructions: string;
  };
  cash_on_delivery: {
    enabled: boolean;
    instructions: string;
    requires_admin_approval: boolean;
  };
}

export function getPaymentReadiness() {
  const settings = getSetting<PaymentGatewaySettings>('payments')!;
  const paystackSecretConfigured = Boolean(process.env.PAYSTACK_SECRET_KEY);
  const paystackPublicConfigured = Boolean(process.env.PAYSTACK_PUBLIC_KEY || settings.paystack?.public_key);
  const flwSecretConfigured = Boolean(process.env.FLUTTERWAVE_SECRET_KEY);
  const flwPublicConfigured = Boolean(process.env.FLUTTERWAVE_PUBLIC_KEY || settings.flutterwave?.public_key);
  const bankConfigured = Boolean(
    settings.bank_transfer?.bank_name &&
      settings.bank_transfer?.account_name &&
      settings.bank_transfer?.account_number
  );

  return {
    paystack: {
      enabled: Boolean(settings.paystack?.enabled),
      mode: settings.paystack?.mode || 'test',
      public_key_configured: paystackPublicConfigured,
      secret_key_configured: paystackSecretConfigured,
      ready: Boolean(settings.paystack?.enabled && paystackSecretConfigured && paystackPublicConfigured),
      public_key: process.env.PAYSTACK_PUBLIC_KEY || settings.paystack?.public_key || '',
      webhook_url: settings.paystack?.webhook_url || '/api/webhooks/paystack',
    },
    flutterwave: {
      enabled: Boolean(settings.flutterwave?.enabled),
      mode: settings.flutterwave?.mode || 'test',
      public_key_configured: flwPublicConfigured,
      secret_key_configured: flwSecretConfigured,
      ready: Boolean(settings.flutterwave?.enabled && flwSecretConfigured && flwPublicConfigured),
      public_key: process.env.FLUTTERWAVE_PUBLIC_KEY || settings.flutterwave?.public_key || '',
      webhook_url: settings.flutterwave?.webhook_url || '/api/webhooks/flutterwave',
    },
    bank_transfer: {
      enabled: Boolean(settings.bank_transfer?.enabled),
      ready: Boolean(settings.bank_transfer?.enabled && bankConfigured),
      bank_name: settings.bank_transfer?.bank_name || '',
      account_name: settings.bank_transfer?.account_name || '',
      account_number: settings.bank_transfer?.account_number || '',
      instructions: settings.bank_transfer?.instructions || '',
    },
    cash_on_delivery: {
      enabled: Boolean(settings.cash_on_delivery?.enabled),
      ready: Boolean(settings.cash_on_delivery?.enabled),
      instructions: settings.cash_on_delivery?.instructions || '',
      requires_admin_approval: Boolean(settings.cash_on_delivery?.requires_admin_approval),
    },
  };
}

export async function initializeOnlinePayment(params: {
  provider: 'paystack' | 'flutterwave';
  orderId: string;
  orderNumber: string;
  email: string;
  customerName: string;
  amountKobo: number;
  currency: string;
  reference: string;
  callbackUrl: string;
}): Promise<{ authorization_url: string; reference: string }> {
  if (params.provider === 'paystack') {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) {
      throw new Error('Paystack secret key is not configured on the server.');
    }
    const resp = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: params.email,
        amount: params.amountKobo, // Paystack expects kobo for NGN
        currency: params.currency,
        reference: params.reference,
        callback_url: params.callbackUrl,
        metadata: {
          order_id: params.orderId,
          order_number: params.orderNumber,
        },
      }),
    });
    const json = (await resp.json()) as {
      status?: boolean;
      message?: string;
      data?: { authorization_url?: string; reference?: string };
    };
    if (!resp.ok || !json.status || !json.data?.authorization_url) {
      throw new Error(json.message || 'Paystack payment initialization failed.');
    }
    return {
      authorization_url: json.data.authorization_url,
      reference: json.data.reference || params.reference,
    };
  }

  // Flutterwave expects major units (Naira)
  const flwSecret = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!flwSecret) {
    throw new Error('Flutterwave secret key is not configured on the server.');
  }
  const resp = await fetch('https://api.flutterwave.com/v3/payments', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${flwSecret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tx_ref: params.reference,
      amount: params.amountKobo / 100,
      currency: params.currency,
      redirect_url: params.callbackUrl,
      customer: {
        email: params.email,
        name: params.customerName,
      },
      meta: {
        order_id: params.orderId,
        order_number: params.orderNumber,
      },
    }),
  });
  const json = (await resp.json()) as {
    status?: string;
    message?: string;
    data?: { link?: string };
  };
  if (!resp.ok || json.status !== 'success' || !json.data?.link) {
    throw new Error(json.message || 'Flutterwave payment initialization failed.');
  }
  return {
    authorization_url: json.data.link,
    reference: params.reference,
  };
}

export async function verifyOnlinePayment(provider: 'paystack' | 'flutterwave', reference: string, transactionId?: string) {
  const payment = db.prepare('SELECT * FROM payments WHERE reference = ?').get(reference) as
    | {
        id: string;
        order_id: string;
        provider: string;
        reference: string;
        amount_kobo: number;
        currency: string;
        status: string;
      }
    | undefined;

  if (!payment) {
    throw new Error('Payment record not found.');
  }
  if (payment.status === 'successful') {
    return { status: 'successful', alreadyVerified: true, orderId: payment.order_id };
  }

  if (provider === 'paystack') {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) throw new Error('Paystack secret key is not configured.');

    const resp = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    const json = (await resp.json()) as {
      status?: boolean;
      data?: { status?: string; amount?: number; currency?: string; reference?: string };
    };
    if (!resp.ok || !json.status || !json.data) {
      throw new Error('Failed to verify transaction with Paystack.');
    }

    const paid =
      json.data.status === 'success' &&
      Number(json.data.amount) === payment.amount_kobo &&
      String(json.data.currency).toUpperCase() === payment.currency.toUpperCase();

    return finalizeGatewayVerification(payment.id, payment.order_id, paid, json.data);
  }

  const flwSecret = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!flwSecret) throw new Error('Flutterwave secret key is not configured.');
  if (!transactionId) throw new Error('Flutterwave transaction_id is required for verification.');

  const resp = await fetch(`https://api.flutterwave.com/v3/transactions/${encodeURIComponent(transactionId)}/verify`, {
    headers: { Authorization: `Bearer ${flwSecret}` },
  });
  const json = (await resp.json()) as {
    status?: string;
    data?: { status?: string; amount?: number; currency?: string; tx_ref?: string };
  };
  if (!resp.ok || json.status !== 'success' || !json.data) {
    throw new Error('Failed to verify transaction with Flutterwave.');
  }

  const paid =
    json.data.status === 'successful' &&
    Math.round(Number(json.data.amount) * 100) === payment.amount_kobo &&
    String(json.data.currency).toUpperCase() === payment.currency.toUpperCase() &&
    json.data.tx_ref === reference;

  return finalizeGatewayVerification(payment.id, payment.order_id, paid, json.data);
}

export function finalizeGatewayVerification(
  paymentId: string,
  orderId: string,
  isPaid: boolean,
  gatewayData: unknown
) {
  const order = db.prepare('SELECT id, order_number, customer_email, payment_status FROM orders WHERE id = ?').get(orderId) as
    | { id: string; order_number: string; customer_email: string; payment_status: string }
    | undefined;
  if (!order) throw new Error('Order not found.');

  if (order.payment_status === 'paid') {
    return { status: 'successful', alreadyVerified: true, orderId };
  }

  const tx = db.transaction(() => {
    if (isPaid) {
      db.prepare(`
        UPDATE payments SET status = 'successful', gateway_response = ?, verified_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `).run(JSON.stringify(gatewayData), paymentId);

      db.prepare(`
        UPDATE orders SET payment_status = 'paid', order_status = 'payment_confirmed', reservation_expires_at = NULL, updated_at = datetime('now')
        WHERE id = ?
      `).run(orderId);

      db.prepare(`
        INSERT INTO order_status_history (id, order_id, status, note)
        VALUES (?, ?, 'payment_confirmed', 'Online payment verified server-side.')
      `).run(crypto.randomUUID(), orderId);

      // Deduct reserved stock permanently
      const items = db
        .prepare('SELECT variant_id, quantity FROM order_items WHERE order_id = ?')
        .all(orderId) as { variant_id: string | null; quantity: number }[];

      for (const item of items) {
        if (!item.variant_id) continue;
        db.prepare(`
          UPDATE inventory
          SET quantity_on_hand = MAX(0, quantity_on_hand - ?),
              quantity_reserved = MAX(0, quantity_reserved - ?),
              updated_at = datetime('now')
          WHERE variant_id = ?
        `).run(item.quantity, item.quantity, item.variant_id);

        db.prepare(`
          INSERT INTO inventory_movements (id, variant_id, delta, reason, reference_id)
          VALUES (?, ?, ?, 'order_paid_deduction', ?)
        `).run(crypto.randomUUID(), item.variant_id, -item.quantity, order.order_number);
      }
    } else {
      db.prepare(`
        UPDATE payments SET status = 'failed', gateway_response = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(JSON.stringify(gatewayData), paymentId);

      db.prepare(`
        UPDATE orders SET payment_status = 'failed', order_status = 'payment_failed', updated_at = datetime('now')
        WHERE id = ?
      `).run(orderId);

      db.prepare(`
        INSERT INTO order_status_history (id, order_id, status, note)
        VALUES (?, ?, 'payment_failed', 'Gateway verification returned unsuccessful payment.')
      `).run(crypto.randomUUID(), orderId);
    }
  });

  tx();

  createNotification({
    recipientType: 'admin',
    title: isPaid ? `Payment Confirmed · ${order.order_number}` : `Payment Failed · ${order.order_number}`,
    message: isPaid
      ? `Online payment for order ${order.order_number} has been verified.`
      : `Online payment verification failed for order ${order.order_number}.`,
  });

  createNotification({
    recipientType: 'customer',
    recipientEmail: order.customer_email,
    title: isPaid ? `Payment Confirmed — ${order.order_number}` : `Payment Issue — ${order.order_number}`,
    message: isPaid
      ? `We have confirmed your payment for order ${order.order_number}. Your order is now being prepared.`
      : `Your payment for order ${order.order_number} could not be confirmed.`,
    sendEmail: true,
  });

  return { status: isPaid ? 'successful' : 'failed', alreadyVerified: false, orderId };
}

export function verifyPaystackSignature(rawBody: string, signature: string | undefined): boolean {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret || !signature) return false;
  const hash = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
  const a = Buffer.from(hash);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function verifyFlutterwaveSignature(verifHash: string | undefined): boolean {
  const expected = process.env.FLUTTERWAVE_WEBHOOK_HASH;
  if (!expected || !verifHash) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(verifHash);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
