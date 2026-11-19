import crypto from 'crypto';
import { db } from '../db';

export async function createNotification(params: {
  recipientType: 'customer' | 'admin';
  recipientEmail?: string;
  title: string;
  message: string;
  sendEmail?: boolean;
  metadata?: Record<string, unknown>;
}) {
  let deliveryStatus: 'recorded' | 'sent' | 'not_configured' | 'failed' = 'recorded';
  const channel: 'in_app' | 'email' = params.sendEmail && params.recipientEmail ? 'email' : 'in_app';

  if (channel === 'email' && params.recipientEmail) {
    const apiKey = process.env.EMAIL_PROVIDER_API_KEY;
    const fromEmail = process.env.EMAIL_FROM_ADDRESS;
    if (!apiKey || !fromEmail) {
      deliveryStatus = 'not_configured';
    } else {
      try {
        const resp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [params.recipientEmail],
            subject: params.title,
            html: `<div style="font-family:Inter,sans-serif;color:#101820;max-width:560px;margin:0 auto;padding:24px;background:#F7F5F0;">
              <h2 style="font-family:'Playfair Display',Georgia,serif;margin:0 0 12px;">DIAMOND STORE</h2>
              <p style="font-size:15px;line-height:1.6;">${params.message}</p>
              <hr style="border:none;border-top:1px solid #d9d4c9;margin:20px 0;" />
              <p style="font-size:12px;color:#707782;">Diamond Store · Ogbomoso, Oyo State, Nigeria</p>
            </div>`,
          }),
        });
        deliveryStatus = resp.ok ? 'sent' : 'failed';
      } catch {
        deliveryStatus = 'failed';
      }
    }
  }

  db.prepare(`
    INSERT INTO notifications (id, recipient_type, recipient_email, title, message, channel, delivery_status, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    crypto.randomUUID(),
    params.recipientType,
    params.recipientEmail ?? null,
    params.title,
    params.message,
    channel,
    deliveryStatus,
    JSON.stringify(params.metadata ?? {})
  );
}
