-- Diamond Store: Supabase Storage Buckets & Policies

insert into storage.buckets (id, name, public)
values
  ('product-images', 'product-images', true),
  ('site-assets', 'site-assets', true)
on conflict (id) do nothing;

create policy "Public Read Product Images"
  on storage.objects for select
  using (bucket_id in ('product-images', 'site-assets'));

create policy "Staff Upload Product Images"
  on storage.objects for insert
  with check (
    bucket_id in ('product-images', 'site-assets')
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and is_active = true
        and role in ('super_admin', 'store_manager', 'product_manager', 'content_manager')
    )
  );

create policy "Staff Delete Product Images"
  on storage.objects for delete
  using (
    bucket_id in ('product-images', 'site-assets')
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and is_active = true
        and role in ('super_admin', 'store_manager', 'product_manager', 'content_manager')
    )
  );
