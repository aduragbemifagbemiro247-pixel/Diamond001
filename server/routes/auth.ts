import { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { db } from '../db';
import {
  ADMIN_COOKIE,
  CUSTOMER_COOKIE,
  AuthenticatedRequest,
  checkRateLimit,
  clearSessionCookie,
  createSession,
  hashPassword,
  hashToken,
  logAdminActivity,
  recordAuthAttempt,
  requireCustomer,
  requireStaff,
  resolveSessionUser,
  revokeSession,
  setSessionCookie,
  STAFF_ROLES,
  verifyPassword,
} from '../security';
import { createNotification } from '../services/notifications';

export const authRouter = Router();

// ==================== CUSTOMER AUTH & ACCOUNT ====================

authRouter.post('/auth/register', (req, res) => {
  const schema = z.object({
    full_name: z.string().min(2),
    email: z.string().email(),
    phone: z.string().min(6).optional(),
    password: z.string().min(8),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid registration data.' });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const existing = db.prepare('SELECT id FROM profiles WHERE LOWER(email) = ?').get(email);
  if (existing) {
    res.status(409).json({ error: 'An account with this email already exists.' });
    return;
  }

  const profileId = crypto.randomUUID();
  const passwordHash = hashPassword(parsed.data.password);

  db.transaction(() => {
    // Role is strictly hardcoded to 'customer'; never accepted from request body
    db.prepare(`
      INSERT INTO profiles (id, email, password_hash, full_name, phone, role, is_active)
      VALUES (?, ?, ?, ?, ?, 'customer', 1)
    `).run(profileId, email, passwordHash, parsed.data.full_name.trim(), parsed.data.phone?.trim() || null);

    const existingCustomer = db.prepare('SELECT id FROM customers WHERE LOWER(email) = ?').get(email) as
      | { id: string }
      | undefined;
    if (existingCustomer) {
      db.prepare('UPDATE customers SET profile_id = ?, full_name = ?, phone = COALESCE(?, phone) WHERE id = ?').run(
        profileId,
        parsed.data.full_name.trim(),
        parsed.data.phone?.trim() || null,
        existingCustomer.id
      );
    } else {
      db.prepare(`
        INSERT INTO customers (id, profile_id, email, full_name, phone, status)
        VALUES (?, ?, ?, ?, ?, 'active')
      `).run(crypto.randomUUID(), profileId, email, parsed.data.full_name.trim(), parsed.data.phone?.trim() || null);
    }
  })();

  const token = createSession(profileId, 'customer');
  setSessionCookie(res, CUSTOMER_COOKIE, token);

  createNotification({
    recipientType: 'admin',
    title: 'New Customer Registration',
    message: `${parsed.data.full_name} (${email}) registered an account.`,
  });
  createNotification({
    recipientType: 'customer',
    recipientEmail: email,
    title: 'Welcome to Diamond Store',
    message: `Welcome, ${parsed.data.full_name}. Your Diamond Store customer account is ready.`,
    sendEmail: true,
  });

  res.status(201).json({
    user: {
      id: profileId,
      email,
      full_name: parsed.data.full_name.trim(),
      phone: parsed.data.phone?.trim() || null,
      role: 'customer',
    },
  });
});

authRouter.post('/auth/login', (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const ip = req.ip || 'unknown';
  if (!checkRateLimit(email, ip)) {
    res.status(429).json({ error: 'Too many failed login attempts. Please try again in 15 minutes.' });
    return;
  }

  const profile = db
    .prepare('SELECT id, email, password_hash, full_name, phone, role, is_active FROM profiles WHERE LOWER(email) = ?')
    .get(email) as
    | {
        id: string;
        email: string;
        password_hash: string;
        full_name: string;
        phone: string | null;
        role: string;
        is_active: number;
      }
    | undefined;

  if (!profile || !verifyPassword(parsed.data.password, profile.password_hash)) {
    recordAuthAttempt(email, ip, false);
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  if (!profile.is_active) {
    res.status(403).json({ error: 'Account is deactivated.' });
    return;
  }

  const cust = db.prepare('SELECT status FROM customers WHERE profile_id = ?').get(profile.id) as
    | { status: string }
    | undefined;
  if (cust?.status === 'suspended') {
    res.status(403).json({ error: 'Your customer account has been suspended.' });
    return;
  }

  recordAuthAttempt(email, ip, true);
  const token = createSession(profile.id, 'customer');
  setSessionCookie(res, CUSTOMER_COOKIE, token);

  res.json({
    user: {
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      phone: profile.phone,
      role: profile.role,
    },
  });
});

authRouter.post('/auth/logout', (req, res) => {
  revokeSession(req.cookies?.[CUSTOMER_COOKIE]);
  clearSessionCookie(res, CUSTOMER_COOKIE);
  res.json({ ok: true });
});

authRouter.get('/auth/me', (req, res) => {
  const user = resolveSessionUser(req, 'customer');
  if (!user) {
    res.json({ user: null });
    return;
  }
  const customer = db.prepare('SELECT id, whatsapp_number, status FROM customers WHERE profile_id = ?').get(user.id) as
    | { id: string; whatsapp_number: string | null; status: string }
    | undefined;
  res.json({
    user: {
      ...user,
      customer_id: customer?.id ?? null,
      whatsapp_number: customer?.whatsapp_number ?? null,
      status: customer?.status ?? 'active',
    },
  });
});

authRouter.post('/auth/forgot-password', (req, res) => {
  const schema = z.object({ email: z.string().email() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Please enter a valid email address.' });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const profile = db.prepare('SELECT id, email FROM profiles WHERE LOWER(email) = ?').get(email) as
    | { id: string; email: string }
    | undefined;

  if (profile) {
    const rawToken = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    db.prepare(`
      INSERT INTO password_resets (id, profile_id, token_hash, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(crypto.randomUUID(), profile.id, hashToken(rawToken), expiresAt);

    createNotification({
      recipientType: 'customer',
      recipientEmail: profile.email,
      title: 'Diamond Store Password Reset',
      message: `Use this password reset token within 30 minutes: ${rawToken}`,
      sendEmail: true,
    });
  }

  res.json({
    message: 'If an account matches that email address, password reset instructions have been issued.',
  });
});

authRouter.post('/auth/reset-password', (req, res) => {
  const schema = z.object({
    token: z.string().min(10),
    new_password: z.string().min(8),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Provide a valid reset token and a password of at least 8 characters.' });
    return;
  }

  const resetRow = db
    .prepare('SELECT id, profile_id, expires_at, used_at FROM password_resets WHERE token_hash = ?')
    .get(hashToken(parsed.data.token.trim())) as
    | { id: string; profile_id: string; expires_at: string; used_at: string | null }
    | undefined;

  if (!resetRow || resetRow.used_at || new Date(resetRow.expires_at).getTime() < Date.now()) {
    res.status(400).json({ error: 'Reset token is invalid or expired.' });
    return;
  }

  db.transaction(() => {
    db.prepare("UPDATE profiles SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(
      hashPassword(parsed.data.new_password),
      resetRow.profile_id
    );
    db.prepare("UPDATE password_resets SET used_at = datetime('now') WHERE id = ?").run(resetRow.id);
    db.prepare('DELETE FROM sessions WHERE profile_id = ?').run(resetRow.profile_id);
  })();

  res.json({ message: 'Password updated successfully. You may now sign in.' });
});

authRouter.put('/account/profile', requireCustomer, (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    full_name: z.string().min(2),
    phone: z.string().optional(),
    whatsapp_number: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid profile fields.' });
    return;
  }

  const user = req.authUser!;
  db.transaction(() => {
    // Only updates safe profile fields; never touches role!
    db.prepare("UPDATE profiles SET full_name = ?, phone = ?, updated_at = datetime('now') WHERE id = ?").run(
      parsed.data.full_name.trim(),
      parsed.data.phone?.trim() || null,
      user.id
    );
    db.prepare(
      "UPDATE customers SET full_name = ?, phone = ?, whatsapp_number = ?, updated_at = datetime('now') WHERE profile_id = ?"
    ).run(
      parsed.data.full_name.trim(),
      parsed.data.phone?.trim() || null,
      parsed.data.whatsapp_number?.trim() || null,
      user.id
    );
  })();

  res.json({ ok: true });
});

authRouter.get('/account/addresses', requireCustomer, (req: AuthenticatedRequest, res) => {
  const customer = db.prepare('SELECT id FROM customers WHERE profile_id = ?').get(req.authUser!.id) as
    | { id: string }
    | undefined;
  if (!customer) {
    res.json({ addresses: [] });
    return;
  }
  const addresses = db
    .prepare('SELECT * FROM addresses WHERE customer_id = ? ORDER BY is_default DESC, created_at DESC')
    .all(customer.id);
  res.json({ addresses });
});

authRouter.post('/account/addresses', requireCustomer, (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    label: z.string().min(1).default('Home'),
    full_name: z.string().min(2),
    phone: z.string().min(6),
    country: z.string().min(2),
    state: z.string().min(2),
    city: z.string().min(2),
    address_line: z.string().min(4),
    postal_code: z.string().optional(),
    is_default: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Please complete all required address fields.' });
    return;
  }

  const customer = db.prepare('SELECT id FROM customers WHERE profile_id = ?').get(req.authUser!.id) as
    | { id: string }
    | undefined;
  if (!customer) {
    res.status(404).json({ error: 'Customer profile not found.' });
    return;
  }

  const id = crypto.randomUUID();
  db.transaction(() => {
    if (parsed.data.is_default) {
      db.prepare('UPDATE addresses SET is_default = 0 WHERE customer_id = ?').run(customer.id);
    }
    db.prepare(`
      INSERT INTO addresses (id, customer_id, label, full_name, phone, country, state, city, address_line, postal_code, is_default)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      customer.id,
      parsed.data.label,
      parsed.data.full_name,
      parsed.data.phone,
      parsed.data.country,
      parsed.data.state,
      parsed.data.city,
      parsed.data.address_line,
      parsed.data.postal_code || null,
      parsed.data.is_default ? 1 : 0
    );
  })();

  res.status(201).json({ id });
});

authRouter.delete('/account/addresses/:id', requireCustomer, (req: AuthenticatedRequest, res) => {
  const customer = db.prepare('SELECT id FROM customers WHERE profile_id = ?').get(req.authUser!.id) as
    | { id: string }
    | undefined;
  if (!customer) {
    res.status(404).json({ error: 'Customer not found.' });
    return;
  }
  db.prepare('DELETE FROM addresses WHERE id = ? AND customer_id = ?').run(req.params.id, customer.id);
  res.json({ ok: true });
});

authRouter.get('/account/orders', requireCustomer, (req: AuthenticatedRequest, res) => {
  const customer = db.prepare('SELECT id, email FROM customers WHERE profile_id = ?').get(req.authUser!.id) as
    | { id: string; email: string }
    | undefined;
  if (!customer) {
    res.json({ orders: [], payments: [] });
    return;
  }

  const orders = db
    .prepare(`
      SELECT o.*, d.tracking_number, d.courier_company, d.status as delivery_status, d.estimated_delivery_date
      FROM orders o
      LEFT JOIN deliveries d ON d.order_id = o.id
      WHERE o.customer_id = ? OR LOWER(o.customer_email) = ?
      ORDER BY o.created_at DESC
    `)
    .all(customer.id, customer.email.toLowerCase()) as Record<string, unknown>[];

  const orderIds = orders.map((o) => o.id as string);
  let items: Record<string, unknown>[] = [];
  let payments: Record<string, unknown>[] = [];
  if (orderIds.length > 0) {
    const ph = orderIds.map(() => '?').join(',');
    items = db.prepare(`SELECT * FROM order_items WHERE order_id IN (${ph})`).all(...orderIds) as Record<
      string,
      unknown
    >[];
    payments = db
      .prepare(`
        SELECT p.*, o.order_number FROM payments p
        JOIN orders o ON o.id = p.order_id
        WHERE p.order_id IN (${ph})
        ORDER BY p.created_at DESC
      `)
      .all(...orderIds) as Record<string, unknown>[];
  }

  res.json({
    orders: orders.map((o) => ({
      ...o,
      internal_notes: undefined, // Never expose staff internal notes to customer
      items: items.filter((i) => i.order_id === o.id),
    })),
    payments,
  });
});

// ==================== ADMIN AUTHENTICATION & BOOTSTRAP ====================

authRouter.get('/admin/bootstrap-status', (_req, res) => {
  const countRow = db
    .prepare("SELECT COUNT(*) as c FROM profiles WHERE role = 'super_admin'")
    .get() as { c: number };
  const secretConfigured = Boolean(process.env.ADMIN_BOOTSTRAP_SECRET && process.env.ADMIN_BOOTSTRAP_SECRET.length >= 12);
  res.json({
    initialized: countRow.c > 0,
    secret_configured: secretConfigured,
  });
});

authRouter.post('/admin/bootstrap', (req, res) => {
  const existingAdmin = db
    .prepare("SELECT COUNT(*) as c FROM profiles WHERE role = 'super_admin'")
    .get() as { c: number };
  if (existingAdmin.c > 0) {
    res.status(403).json({ error: 'Super Admin initialization has already been completed and is permanently locked.' });
    return;
  }

  const expectedSecret = process.env.ADMIN_BOOTSTRAP_SECRET;
  if (!expectedSecret || expectedSecret.length < 12) {
    res.status(503).json({
      error:
        'ADMIN_BOOTSTRAP_SECRET environment variable is not configured (minimum 12 characters). Set it in your server environment before initializing the Super Admin.',
    });
    return;
  }

  const schema = z.object({
    bootstrap_secret: z.string().min(1),
    full_name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(10, 'Super Admin password must be at least 10 characters.'),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid bootstrap input.' });
    return;
  }

  const provided = Buffer.from(parsed.data.bootstrap_secret);
  const expected = Buffer.from(expectedSecret);
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    recordAuthAttempt(parsed.data.email, req.ip || 'unknown', false);
    res.status(403).json({ error: 'Invalid bootstrap secret.' });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const existingEmail = db.prepare('SELECT id FROM profiles WHERE LOWER(email) = ?').get(email);
  if (existingEmail) {
    res.status(409).json({ error: 'Email already exists in profiles.' });
    return;
  }

  const adminId = crypto.randomUUID();
  db.prepare(`
    INSERT INTO profiles (id, email, password_hash, full_name, role, is_active)
    VALUES (?, ?, ?, ?, 'super_admin', 1)
  `).run(adminId, email, hashPassword(parsed.data.password), parsed.data.full_name.trim());

  logAdminActivity({
    actorId: adminId,
    actorEmail: email,
    action: 'super_admin_bootstrapped',
    entityType: 'profile',
    entityId: adminId,
    ipAddress: req.ip,
  });

  const token = createSession(adminId, 'admin', 12);
  setSessionCookie(res, ADMIN_COOKIE, token, 12 * 3600 * 1000);

  res.status(201).json({
    admin: {
      id: adminId,
      email,
      full_name: parsed.data.full_name.trim(),
      role: 'super_admin',
    },
  });
});

authRouter.post('/admin/login', (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const ip = req.ip || 'unknown';
  if (!checkRateLimit(`admin:${email}`, ip)) {
    res.status(429).json({ error: 'Too many failed admin login attempts. Try again in 15 minutes.' });
    return;
  }

  const profile = db
    .prepare('SELECT id, email, password_hash, full_name, phone, role, is_active FROM profiles WHERE LOWER(email) = ?')
    .get(email) as
    | {
        id: string;
        email: string;
        password_hash: string;
        full_name: string;
        phone: string | null;
        role: string;
        is_active: number;
      }
    | undefined;

  const isStaffRole = profile && (STAFF_ROLES as string[]).includes(profile.role);
  if (!profile || !isStaffRole || !verifyPassword(parsed.data.password, profile.password_hash)) {
    recordAuthAttempt(`admin:${email}`, ip, false);
    logAdminActivity({
      actorId: profile?.id ?? null,
      actorEmail: email,
      action: 'admin_login_failed',
      entityType: 'auth',
      ipAddress: ip,
    });
    res.status(401).json({ error: 'Invalid staff credentials.' });
    return;
  }

  if (!profile.is_active) {
    res.status(403).json({ error: 'Staff account is deactivated.' });
    return;
  }

  recordAuthAttempt(`admin:${email}`, ip, true);
  logAdminActivity({
    actorId: profile.id,
    actorEmail: profile.email,
    action: 'admin_login_success',
    entityType: 'auth',
    ipAddress: ip,
  });

  const token = createSession(profile.id, 'admin', 12);
  setSessionCookie(res, ADMIN_COOKIE, token, 12 * 3600 * 1000);

  const resolved = resolveSessionUser({ ...req, cookies: { [ADMIN_COOKIE]: token } } as typeof req, 'admin');
  res.json({ admin: resolved });
});

authRouter.post('/admin/logout', requireStaff, (req: AuthenticatedRequest, res) => {
  logAdminActivity({
    actorId: req.authUser!.id,
    actorEmail: req.authUser!.email,
    action: 'admin_logout',
    entityType: 'auth',
    ipAddress: req.ip,
  });
  revokeSession(req.cookies?.[ADMIN_COOKIE]);
  clearSessionCookie(res, ADMIN_COOKIE);
  res.json({ ok: true });
});

authRouter.get('/admin/me', (req, res) => {
  const admin = resolveSessionUser(req, 'admin');
  res.json({ admin });
});
