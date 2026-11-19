# Diamond Store — Architecture, Supabase & Vercel Deployment Guide

## 1. Environment Variables
Copy `.env.example` to `.env` (or configure them in Vercel / AI Studio Secrets):

- `APP_URL`: Public origin URL (e.g. `https://your-domain.vercel.app`)
- `ADMIN_BOOTSTRAP_SECRET`: Minimum 12-character one-time secret for initializing the first Super Admin at `/admin/login`.
- `SESSION_SECRET`: Strong random string for signing cookies/sessions.
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`: Production Supabase PostgreSQL, Auth, and Storage credentials.
- `PAYSTACK_PUBLIC_KEY`, `PAYSTACK_SECRET_KEY`: Paystack API credentials (test mode first before switching to live).
- `FLUTTERWAVE_PUBLIC_KEY`, `FLUTTERWAVE_SECRET_KEY`, `FLUTTERWAVE_WEBHOOK_HASH`: Flutterwave API & webhook credentials.
- `EMAIL_PROVIDER_API_KEY`, `EMAIL_FROM_ADDRESS`: Resend API key and verified sender address for customer/admin email notifications.

## 2. Supabase Database & Storage Setup
1. Create a Supabase project.
2. Execute the SQL migrations in order via Supabase SQL Editor or Supabase CLI (`supabase db push`):
   - `supabase/migrations/001_initial_schema.sql` (creates all 24 tables + inventory movements + order history)
   - `supabase/migrations/002_rls_policies.sql` (strict customer isolation & staff RBAC Row Level Security)
   - `supabase/migrations/003_storage_buckets.sql` (creates `product-images` & `site-assets` buckets)
   - Optional for dev testing only: `supabase/migrations/004_dev_seed.sql`
3. In Supabase Authentication -> URL Configuration, add `${APP_URL}/account` and `${APP_URL}/admin/login` to Redirect URLs.

## 3. Super Admin Initialization (Mandatory Security Flow)
1. Ensure `ADMIN_BOOTSTRAP_SECRET` is configured in server environment variables.
2. Navigate to `/admin/login`.
3. When no Super Admin exists in the database, the one-time **Initial Super Admin Setup** form is displayed.
4. Enter `ADMIN_BOOTSTRAP_SECRET`, Full Name, Email, and a strong password (minimum 10 characters).
5. Once created, the bootstrap endpoint locks permanently (`403 Forbidden`) and all subsequent staff accounts must be created by the Super Admin under **Admin -> Staff & Roles** (`/admin/staff`).

## 4. Payment Webhooks
- **Paystack Webhook URL**: `${APP_URL}/api/webhooks/paystack` (verified using `x-paystack-signature` HMAC-SHA512).
- **Flutterwave Webhook URL**: `${APP_URL}/api/webhooks/flutterwave` (verified using `verif-hash`).
- Payment settings can be toggled in **Admin -> Payments** (`/admin/payments`). Paystack/Flutterwave will only appear at checkout once enabled AND server secret/public keys are configured.

## 5. Running & Testing Locally
- Development server: `npm run dev`
- Production build: `npm run build`
- Automated test suite: `npm test`
- Development catalog seed (optional): `npm run seed:dev`

## 6. Outstanding External Configurations Required Before Going Live
- Provide live `PAYSTACK_SECRET_KEY` / `FLUTTERWAVE_SECRET_KEY` or configure Bank Transfer account details in `/admin/payments`.
- Configure `EMAIL_PROVIDER_API_KEY` & `EMAIL_FROM_ADDRESS` for live email delivery.
- Configure business email, phone, WhatsApp number, and social links in **Admin -> Settings**.
