-- Diamond Store: Safe Development Seed SQL (Optional — Do NOT run blindly on live production without reviewing)
-- Note: Zero invented business phone numbers, emails, street addresses, or courier partnerships.

insert into public.categories (name, slug, description, display_order, is_active) values
  ('Men''s Clothing', 'mens-clothing', 'Tailored shirts, structured blazers, and refined menswear.', 1, true),
  ('Shoes', 'shoes', 'Handcrafted leather dress shoes, loafers, and boots.', 2, true),
  ('Accessories', 'accessories', 'Full-grain leather belts, dress timepieces, and finishing accents.', 3, true),
  ('New Arrivals', 'new-arrivals', 'Latest seasonal additions to Diamond Store.', 4, true),
  ('Best Sellers', 'best-sellers', 'Most requested pieces across Nigeria and worldwide.', 5, true),
  ('Special Offers', 'special-offers', 'Selected items currently offered at promotional pricing.', 6, true)
on conflict (slug) do nothing;

insert into public.store_settings (key, value) values
  ('general', '{"store_name":"Diamond Store","location":"Ogbomoso, Oyo State, Nigeria","currency":"NGN","timezone":"Africa/Lagos","business_email":"","business_phone":"","whatsapp_number":"","social_links":{"instagram":"","x":"","facebook":""}}'::jsonb),
  ('delivery', '{"nigeria_enabled":true,"international_enabled":true,"default_fee_kobo":0,"default_payable_on_arrival":true,"notes":"Delivery fees are confirmed per order and payable on delivery day by default."}'::jsonb),
  ('returns', '{"enabled":false,"deadline_days":0,"conditions":"Returns are currently disabled. Please contact customer support before placing special sizing orders."}'::jsonb),
  ('payments', '{"paystack":{"enabled":false,"mode":"test"},"flutterwave":{"enabled":false,"mode":"test"},"bank_transfer":{"enabled":false,"bank_name":"","account_name":"","account_number":"","instructions":""},"cash_on_delivery":{"enabled":true,"instructions":"Payable upon delivery confirmation.","requires_admin_approval":false}}'::jsonb)
on conflict (key) do nothing;
