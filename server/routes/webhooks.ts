import { Router } from 'express';
import { db } from '../db';
import {
  finalizeGatewayVerification,
  verifyFlutterwaveSignature,
  verifyOnlinePayment,
  verifyPaystackSignature,
} from '../services/payments';

export const webhooksRouter = Router();

webhooksRouter.get('/payments/verify', async (req, res) => {
  const provider = String(req.query.provider || '');
  const reference = String(req.query.reference || req.query.trxref || req.query.tx_ref || '');
  const transactionId = req.query.transaction_id ? String(req.query.transaction_id) : undefined;

  if ((provider !== 'paystack' && provider !== 'flutterwave') || !reference) {
    res.status(400).json({ error: 'Missing payment provider or transaction reference.' });
    return;
  }

  try {
    const result = await verifyOnlinePayment(provider, reference, transactionId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Verification failed.' });
  }
});

webhooksRouter.post('/webhooks/paystack', (req, res) => {
  const rawBody = (req as unknown as { rawBody?: string }).rawBody || JSON.stringify(req.body);
  const signature = req.headers['x-paystack-signature'] as string | undefined;

  if (!verifyPaystackSignature(rawBody, signature)) {
    res.status(401).json({ error: 'Invalid Paystack webhook signature.' });
    return;
  }

  const event = req.body as {
    event?: string;
    data?: { reference?: string; amount?: number; currency?: string; status?: string };
  };

  if (event.event === 'charge.success' && event.data?.reference) {
    const payment = db.prepare('SELECT * FROM payments WHERE reference = ?').get(event.data.reference) as
      | { id: string; order_id: string; amount_kobo: number; currency: string }
      | undefined;

    if (
      payment &&
      Number(event.data.amount) === payment.amount_kobo &&
      String(event.data.currency || '').toUpperCase() === payment.currency.toUpperCase()
    ) {
      finalizeGatewayVerification(payment.id, payment.order_id, true, event.data);
    }
  }

  res.status(200).json({ received: true });
});

webhooksRouter.post('/webhooks/flutterwave', (req, res) => {
  const verifHash = req.headers['verif-hash'] as string | undefined;
  if (!verifyFlutterwaveSignature(verifHash)) {
    res.status(401).json({ error: 'Invalid Flutterwave webhook signature.' });
    return;
  }

  const payload = req.body as {
    event?: string;
    data?: { tx_ref?: string; amount?: number; currency?: string; status?: string };
  };

  if (payload.event === 'charge.completed' && payload.data?.tx_ref && payload.data.status === 'successful') {
    const payment = db.prepare('SELECT * FROM payments WHERE reference = ?').get(payload.data.tx_ref) as
      | { id: string; order_id: string; amount_kobo: number; currency: string }
      | undefined;

    if (
      payment &&
      Math.round(Number(payload.data.amount) * 100) === payment.amount_kobo &&
      String(payload.data.currency || '').toUpperCase() === payment.currency.toUpperCase()
    ) {
      finalizeGatewayVerification(payment.id, payment.order_id, true, payload.data);
    }
  }

  res.status(200).json({ received: true });
});
