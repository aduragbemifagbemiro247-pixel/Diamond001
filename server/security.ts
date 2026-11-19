import crypto from 'crypto';
import type { CookieOptions, NextFunction, Request, Response } from 'express';
import { db } from './db';

export type StaffRole =
  | 'super_admin'
  | 'store_manager'
  | 'product_manager'
  | 'order_manager'
  | 'content_manager';

export type UserRole = 'customer' | StaffRole;

export const STAFF_ROLES: StaffRole[] = [
  'super_admin',
  'store_manager',
  'product_manager',
  'order_manager',
  'content_manager',
];

export const ALL_PERMISSIONS = [
  'products',
  'categories',
  'orders',
  'payments',
  'deliveries',
  'customers',
  'coupons',
  'returns',
  'reports',
  'content',
  'staff',
  'settings',
  'activity_logs',
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number];

export const DEFAULT_ROLE_PERMISSIONS: Record<StaffRole, Permission[]> = {
  super_admin: [...ALL_PERMISSIONS],
  store_manager: [
    'products',
    'categories',
    'orders',
    'payments',
    'deliveries',
    'customers',
    'coupons',
    'returns',
    'reports',
    'activity_logs',
  ],
  product_manager: ['products', 'categories', 'reports'],
  order_manager: ['orders', 'payments', 'deliveries', 'customers', 'returns'],
  content_manager: ['content', 'coupons'],
};

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  is_active: boolean;
  permissions: Permission[];
}

export interface AuthenticatedRequest extends Request {
  authUser?: AuthUser;
}

export const CUSTOMER_COOKIE = 'diamond_customer_session';
export const ADMIN_COOKIE = 'diamond_admin_session';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  const actualBuf = crypto.scryptSync(password, salt, 64);
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  if (actualBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(actualBuf, expectedBuf);
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function createSession(profileId: string, scope: 'customer' | 'admin', ttlHours = 24 * 7): string {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + ttlHours * 3600 * 1000).toISOString();
  db.prepare(`
    INSERT INTO sessions (id, profile_id, scope, token_hash, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(crypto.randomUUID(), profileId, scope, tokenHash, expiresAt);
  return rawToken;
}

export function revokeSession(rawToken: string | undefined) {
  if (!rawToken) return;
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(rawToken));
}

function isHttpsContext(res: Response): boolean {
  const req = res.req as Request | undefined;
  const forwardedProto = String(req?.headers?.['x-forwarded-proto'] || '').toLowerCase();
  const origin = String(req?.headers?.origin || '').toLowerCase();
  const referer = String(req?.headers?.referer || '').toLowerCase();
  return Boolean(
    process.env.NODE_ENV === 'production' ||
      req?.secure ||
      forwardedProto.includes('https') ||
      origin.startsWith('https://') ||
      referer.startsWith('https://')
  );
}

export function setSessionCookie(res: Response, cookieName: string, token: string, maxAgeMs = 7 * 24 * 3600 * 1000) {
  const https = isHttpsContext(res);
  const options: CookieOptions & { partitioned?: boolean } = {
    httpOnly: true,
    sameSite: https ? 'none' : 'lax',
    secure: https,
    ...(https ? { partitioned: true } : {}),
    path: '/',
    maxAge: maxAgeMs,
  };
  res.cookie(cookieName, token, options);
}

export function clearSessionCookie(res: Response, cookieName: string) {
  const https = isHttpsContext(res);
  const options: CookieOptions & { partitioned?: boolean } = {
    httpOnly: true,
    sameSite: https ? 'none' : 'lax',
    secure: https,
    ...(https ? { partitioned: true } : {}),
    path: '/',
  };
  res.clearCookie(cookieName, options);
}

export function getPermissionsForProfile(profileId: string, role: UserRole): Permission[] {
  if (role === 'customer') return [];
  if (role === 'super_admin') return [...ALL_PERMISSIONS];
  const explicit = db
    .prepare('SELECT permission FROM staff_permissions WHERE profile_id = ?')
    .all(profileId) as { permission: Permission }[];
  if (explicit.length > 0) {
    return explicit.map((r) => r.permission);
  }
  return DEFAULT_ROLE_PERMISSIONS[role] ?? [];
}

export function resolveSessionUser(req: Request, scope: 'customer' | 'admin'): AuthUser | null {
  const cookieName = scope === 'admin' ? ADMIN_COOKIE : CUSTOMER_COOKIE;
  const rawToken = req.cookies?.[cookieName] as string | undefined;
  if (!rawToken) return null;

  const row = db
    .prepare(`
      SELECT p.id, p.email, p.full_name, p.phone, p.role, p.is_active, s.expires_at
      FROM sessions s
      JOIN profiles p ON p.id = s.profile_id
      WHERE s.token_hash = ? AND s.scope = ?
    `)
    .get(hashToken(rawToken), scope) as
    | {
        id: string;
        email: string;
        full_name: string;
        phone: string | null;
        role: UserRole;
        is_active: number;
        expires_at: string;
      }
    | undefined;

  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    revokeSession(rawToken);
    return null;
  }
  if (!row.is_active) return null;
  if (scope === 'admin' && !STAFF_ROLES.includes(row.role as StaffRole)) {
    return null;
  }

  return {
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    phone: row.phone,
    role: row.role,
    is_active: Boolean(row.is_active),
    permissions: getPermissionsForProfile(row.id, row.role),
  };
}

export function checkRateLimit(identifier: string, ipAddress: string, maxAttempts = 5, windowMinutes = 15): boolean {
  const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  const row = db
    .prepare(`
      SELECT COUNT(*) as c FROM auth_attempts
      WHERE (identifier = ? OR ip_address = ?) AND success = 0 AND created_at > ?
    `)
    .get(identifier.toLowerCase(), ipAddress, cutoff) as { c: number };
  return row.c < maxAttempts;
}

export function recordAuthAttempt(identifier: string, ipAddress: string, success: boolean) {
  db.prepare(`
    INSERT INTO auth_attempts (id, identifier, ip_address, success)
    VALUES (?, ?, ?, ?)
  `).run(crypto.randomUUID(), identifier.toLowerCase(), ipAddress, success ? 1 : 0);
}

export function logAdminActivity(params: {
  actorId?: string | null;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Record<string, unknown>;
  ipAddress?: string;
}) {
  db.prepare(`
    INSERT INTO admin_activity_logs (id, actor_id, actor_email, action, entity_type, entity_id, details, ip_address)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    crypto.randomUUID(),
    params.actorId ?? null,
    params.actorEmail,
    params.action,
    params.entityType,
    params.entityId ?? null,
    JSON.stringify(params.details ?? {}),
    params.ipAddress ?? null
  );
}

export function requireCustomer(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const user = resolveSessionUser(req, 'customer');
  if (!user) {
    res.status(401).json({ error: 'Customer authentication required.' });
    return;
  }
  const customer = db.prepare('SELECT status FROM customers WHERE profile_id = ?').get(user.id) as
    | { status: string }
    | undefined;
  if (customer?.status === 'suspended') {
    res.status(403).json({ error: 'Your customer account has been suspended. Please contact support.' });
    return;
  }
  req.authUser = user;
  next();
}

export function requireStaff(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const user = resolveSessionUser(req, 'admin');
  if (!user || !STAFF_ROLES.includes(user.role as StaffRole)) {
    res.status(401).json({ error: 'Staff authentication required.' });
    return;
  }
  req.authUser = user;
  next();
}

export function requirePermission(permission: Permission) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      res.status(401).json({ error: 'Staff authentication required.' });
      return;
    }
    if (req.authUser.role === 'super_admin' || req.authUser.permissions.includes(permission)) {
      next();
      return;
    }
    res.status(403).json({ error: `Insufficient permission: '${permission}' required.` });
  };
}

export function requireSuperAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.authUser || req.authUser.role !== 'super_admin') {
    res.status(403).json({ error: 'Super Admin privileges required.' });
    return;
  }
  next();
}
