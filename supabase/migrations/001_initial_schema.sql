-- Diamond Store: Initial PostgreSQL Schema for Supabase
-- Covers all 24 required tables + inventory_movements + order_status_history + transactional order creation RPC

create extension if not exists "pgcrypto";

-- 1. profiles (staff & user identity linked to auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text not null,
  phone text,
  role text not null default 'customer' check (role in ('customer', 'super_admin', 'store_manager', 'product_manager', 'order_manager', 'content_manager')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. customers
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete set null,
  email text unique not null,
  full_name text not null,
  phone text,
  whatsapp_number text,
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. addresses
create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  label text not null default 'Primary',
  full_name text not null,
  phone text not null,
  country text not null default 'Nigeria',
  state text not null,
  city text not null,
  address_line text not null,
  postal_code text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. categories
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  description text,
  image_url text,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5. products
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  slug text unique not null,
  sku text unique not null,
  description text not null default '',
  regular_price_kobo bigint not null check (regular_price_kobo >= 0),
  sale_price_kobo bigint check (sale_price_kobo is null or sale_price_kobo >= 0),
  is_featured boolean not null default false,
  is_bestseller boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'published', 'hidden')),
  low_stock_threshold integer not null default 5,
  return_policy_override text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6. product_images
create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url text not null,
  alt_text text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- 7. product_variants
create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text unique not null,
  size text not null default 'Standard',
  color text not null default 'Default',
  color_hex text,
  price_override_kobo bigint,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(product_id, size, color)
);

-- 8. inventory
create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid unique not null references public.product_variants(id) on delete cascade,
  quantity_on_hand integer not null default 0 check (quantity_on_hand >= 0),
  quantity_reserved integer not null default 0 check (quantity_reserved >= 0),
  low_stock_threshold integer not null default 5,
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  delta integer not null,
  reason text not null,
  reference_id text,
  actor_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 9. carts & 10. cart_items
create table if not exists public.carts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete cascade,
  guest_token text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now(),
  unique(cart_id, variant_id)
);

-- 11. orders
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null,
  idempotency_key text unique,
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  customer_whatsapp text,
  country text not null,
  state text not null,
  city text not null,
  delivery_address text not null,
  postal_code text,
  delivery_instructions text,
  currency text not null default 'NGN',
  subtotal_kobo bigint not null check (subtotal_kobo >= 0),
  discount_kobo bigint not null default 0 check (discount_kobo >= 0),
  delivery_fee_kobo bigint not null default 0 check (delivery_fee_kobo >= 0),
  delivery_fee_payable_on_arrival boolean not null default true,
  total_kobo bigint not null check (total_kobo >= 0),
  coupon_code text,
  payment_method text not null check (payment_method in ('paystack', 'flutterwave', 'bank_transfer', 'cash_on_delivery')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'awaiting_verification', 'paid', 'failed', 'refunded')),
  order_status text not null default 'order_placed' check (order_status in ('order_placed', 'payment_confirmed', 'processing', 'ready_for_dispatch', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'payment_failed', 'refunded')),
  cancellation_reason text,
  internal_notes text,
  reservation_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null,
  note text,
  actor_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 12. order_items
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  product_name text not null,
  variant_sku text not null,
  size text not null,
  color text not null,
  unit_price_kobo bigint not null,
  quantity integer not null check (quantity > 0),
  line_total_kobo bigint not null
);

-- 13. payments
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null check (provider in ('paystack', 'flutterwave', 'bank_transfer', 'cash_on_delivery')),
  reference text unique not null,
  amount_kobo bigint not null,
  currency text not null default 'NGN',
  status text not null default 'pending' check (status in ('pending', 'awaiting_verification', 'successful', 'failed', 'refunded')),
  gateway_response jsonb,
  verified_by uuid references public.profiles(id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 14. deliveries
create table if not exists public.deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid unique not null references public.orders(id) on delete cascade,
  delivery_fee_kobo bigint not null default 0,
  fee_payment_timing text not null default 'pay_on_arrival' check (fee_payment_timing in ('prepaid', 'pay_on_arrival')),
  delivery_scope text not null default 'nigeria' check (delivery_scope in ('nigeria', 'international')),
  courier_company text,
  assigned_personnel text,
  tracking_number text,
  estimated_delivery_date date,
  instructions text,
  status text not null default 'pending' check (status in ('pending', 'ready_for_dispatch', 'shipped', 'out_for_delivery', 'delivered', 'cancelled')),
  updated_at timestamptz not null default now()
);

-- 15. coupons & 16. coupon_usage
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  discount_type text not null check (discount_type in ('percentage', 'fixed')),
  discount_value bigint not null check (discount_value > 0),
  min_purchase_kobo bigint not null default 0,
  max_discount_kobo bigint,
  usage_limit integer,
  per_customer_limit integer not null default 1,
  used_count integer not null default 0,
  starts_at timestamptz,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.coupon_usage (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  customer_email text not null,
  discount_applied_kobo bigint not null,
  created_at timestamptz not null default now()
);

-- 17. returns & 18. refunds
create table if not exists public.returns (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  customer_email text not null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  payment_id uuid references public.payments(id) on delete set null,
  return_id uuid references public.returns(id) on delete set null,
  amount_kobo bigint not null check (amount_kobo > 0),
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'processed', 'failed')),
  provider_reference text,
  processed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 19. content
create table if not exists public.content (
  key text primary key,
  title text not null,
  body jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- 20. store_settings
create table if not exists public.store_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- 21. staff_permissions
create table if not exists public.staff_permissions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  permission text not null,
  created_at timestamptz not null default now(),
  unique(profile_id, permission)
);

-- 22. admin_activity_logs
create table if not exists public.admin_activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  actor_email text not null,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb default '{}'::jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);

-- 23. notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_type text not null check (recipient_type in ('customer', 'admin')),
  recipient_email text,
  title text not null,
  message text not null,
  channel text not null default 'in_app' check (channel in ('in_app', 'email')),
  delivery_status text not null default 'recorded' check (delivery_status in ('recorded', 'sent', 'not_configured', 'failed')),
  is_read boolean not null default false,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 24. newsletter_subscribers
create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  status text not null default 'subscribed' check (status in ('subscribed', 'unsubscribed')),
  unsubscribe_token text unique not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_products_category on public.products(category_id);
create index if not exists idx_products_status on public.products(status);
create index if not exists idx_variants_product on public.product_variants(product_id);
create index if not exists idx_orders_customer on public.orders(customer_id);
create index if not exists idx_orders_email on public.orders(customer_email);
create index if not exists idx_orders_status on public.orders(order_status);
create index if not exists idx_payments_order on public.payments(order_id);
create index if not exists idx_logs_created on public.admin_activity_logs(created_at desc);
