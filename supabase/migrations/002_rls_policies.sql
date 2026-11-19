-- Diamond Store: Row Level Security (RLS) Policies for Supabase PostgreSQL

alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.addresses enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_variants enable row level security;
alter table public.inventory enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.deliveries enable row level security;
alter table public.coupons enable row level security;
alter table public.coupon_usage enable row level security;
alter table public.returns enable row level security;
alter table public.refunds enable row level security;
alter table public.content enable row level security;
alter table public.store_settings enable row level security;
alter table public.staff_permissions enable row level security;
alter table public.admin_activity_logs enable row level security;
alter table public.notifications enable row level security;
alter table public.newsletter_subscribers enable row level security;

-- Helper functions
create or replace function public.is_staff()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and is_active = true
      and role in ('super_admin', 'store_manager', 'product_manager', 'order_manager', 'content_manager')
  );
$$;

create or replace function public.is_super_admin()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and is_active = true
      and role = 'super_admin'
  );
$$;

create or replace function public.has_permission(req_perm text)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active = true and (
      p.role = 'super_admin' or exists (
        select 1 from public.staff_permissions sp
        where sp.profile_id = p.id and sp.permission = req_perm
      )
    )
  );
$$;

-- Profiles: users can view own profile (never change own role!); super_admin manages staff
create policy "profiles_self_select" on public.profiles
  for select using (id = auth.uid() or public.is_staff());

create policy "profiles_self_update_safe" on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

create policy "profiles_super_admin_all" on public.profiles
  for all using (public.is_super_admin());

-- Customers & Addresses: strict self-isolation
create policy "customers_self_select" on public.customers
  for select using (profile_id = auth.uid() or public.has_permission('customers'));

create policy "addresses_self_all" on public.addresses
  for all using (
    customer_id in (select id from public.customers where profile_id = auth.uid())
    or public.has_permission('customers')
  );

-- Public Catalog Read: only active categories & published products
create policy "categories_public_read" on public.categories
  for select using (is_active = true or public.has_permission('products'));

create policy "categories_staff_write" on public.categories
  for all using (public.has_permission('products'));

create policy "products_public_read" on public.products
  for select using (status = 'published' or public.has_permission('products'));

create policy "products_staff_write" on public.products
  for all using (public.has_permission('products'));

create policy "product_images_public_read" on public.product_images
  for select using (
    exists (select 1 from public.products p where p.id = product_id and p.status = 'published')
    or public.has_permission('products')
  );

create policy "product_variants_public_read" on public.product_variants
  for select using (
    exists (select 1 from public.products p where p.id = product_id and p.status = 'published')
    or public.has_permission('products')
  );

create policy "inventory_public_read" on public.inventory
  for select using (true);

create policy "inventory_staff_write" on public.inventory
  for all using (public.has_permission('products'));

-- Orders, Items, Payments, Deliveries: customer sees only own orders; staff with 'orders'/'payments'/'deliveries'
create policy "orders_customer_read" on public.orders
  for select using (
    customer_id in (select id from public.customers where profile_id = auth.uid())
    or public.has_permission('orders')
  );

create policy "order_items_customer_read" on public.order_items
  for select using (
    order_id in (
      select id from public.orders where customer_id in (select id from public.customers where profile_id = auth.uid())
    )
    or public.has_permission('orders')
  );

create policy "payments_customer_read" on public.payments
  for select using (
    order_id in (
      select id from public.orders where customer_id in (select id from public.customers where profile_id = auth.uid())
    )
    or public.has_permission('payments')
  );

create policy "deliveries_customer_read" on public.deliveries
  for select using (
    order_id in (
      select id from public.orders where customer_id in (select id from public.customers where profile_id = auth.uid())
    )
    or public.has_permission('deliveries')
  );

-- Content & Store Settings
create policy "content_public_read" on public.content for select using (true);
create policy "content_staff_write" on public.content for all using (public.has_permission('content'));

create policy "settings_staff_read" on public.store_settings for select using (public.is_staff());
create policy "settings_super_admin_write" on public.store_settings for all using (public.is_super_admin());

-- Activity Logs & Staff Permissions
create policy "logs_staff_read" on public.admin_activity_logs for select using (public.is_staff());
create policy "staff_permissions_super_admin" on public.staff_permissions for all using (public.is_super_admin());
