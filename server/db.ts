import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = process.env.DIAMOND_DB_PATH || path.join(DATA_DIR, 'diamond_store.db');

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    -- 1. profiles (staff & user identity)
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      phone TEXT,
      role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'super_admin', 'store_manager', 'product_manager', 'order_manager', 'content_manager')),
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 2. customers
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      profile_id TEXT UNIQUE REFERENCES profiles(id) ON DELETE SET NULL,
      email TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      phone TEXT,
      whatsapp_number TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 3. addresses
    CREATE TABLE IF NOT EXISTS addresses (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      label TEXT NOT NULL DEFAULT 'Primary',
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      country TEXT NOT NULL DEFAULT 'Nigeria',
      state TEXT NOT NULL,
      city TEXT NOT NULL,
      address_line TEXT NOT NULL,
      postal_code TEXT,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 4. categories
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT DEFAULT '',
      image_url TEXT DEFAULT '',
      display_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 5. products
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      sku TEXT UNIQUE NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      regular_price_kobo INTEGER NOT NULL CHECK (regular_price_kobo >= 0),
      sale_price_kobo INTEGER CHECK (sale_price_kobo IS NULL OR sale_price_kobo >= 0),
      is_featured INTEGER NOT NULL DEFAULT 0,
      is_bestseller INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'hidden')),
      low_stock_threshold INTEGER NOT NULL DEFAULT 5,
      return_policy_override TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 6. product_images
    CREATE TABLE IF NOT EXISTS product_images (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      alt_text TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 7. product_variants
    CREATE TABLE IF NOT EXISTS product_variants (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      sku TEXT UNIQUE NOT NULL,
      size TEXT NOT NULL DEFAULT 'Standard',
      color TEXT NOT NULL DEFAULT 'Default',
      color_hex TEXT DEFAULT '#101820',
      price_override_kobo INTEGER,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(product_id, size, color)
    );

    -- 8. inventory & inventory_movements
    CREATE TABLE IF NOT EXISTS inventory (
      id TEXT PRIMARY KEY,
      variant_id TEXT UNIQUE NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
      quantity_on_hand INTEGER NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
      quantity_reserved INTEGER NOT NULL DEFAULT 0 CHECK (quantity_reserved >= 0),
      low_stock_threshold INTEGER NOT NULL DEFAULT 5,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS inventory_movements (
      id TEXT PRIMARY KEY,
      variant_id TEXT NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
      delta INTEGER NOT NULL,
      reason TEXT NOT NULL,
      reference_id TEXT,
      actor_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 9. carts & 10. cart_items
    CREATE TABLE IF NOT EXISTS carts (
      id TEXT PRIMARY KEY,
      customer_id TEXT REFERENCES customers(id) ON DELETE CASCADE,
      guest_token TEXT UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cart_items (
      id TEXT PRIMARY KEY,
      cart_id TEXT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      variant_id TEXT NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(cart_id, variant_id)
    );

    -- 11. orders & order_status_history
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_number TEXT UNIQUE NOT NULL,
      idempotency_key TEXT UNIQUE,
      customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_whatsapp TEXT,
      country TEXT NOT NULL,
      state TEXT NOT NULL,
      city TEXT NOT NULL,
      delivery_address TEXT NOT NULL,
      postal_code TEXT,
      delivery_instructions TEXT,
      currency TEXT NOT NULL DEFAULT 'NGN',
      subtotal_kobo INTEGER NOT NULL CHECK (subtotal_kobo >= 0),
      discount_kobo INTEGER NOT NULL DEFAULT 0 CHECK (discount_kobo >= 0),
      delivery_fee_kobo INTEGER NOT NULL DEFAULT 0 CHECK (delivery_fee_kobo >= 0),
      delivery_fee_payable_on_arrival INTEGER NOT NULL DEFAULT 1,
      total_kobo INTEGER NOT NULL CHECK (total_kobo >= 0),
      coupon_code TEXT,
      payment_method TEXT NOT NULL CHECK (payment_method IN ('paystack', 'flutterwave', 'bank_transfer', 'cash_on_delivery')),
      payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'awaiting_verification', 'paid', 'failed', 'refunded')),
      order_status TEXT NOT NULL DEFAULT 'order_placed' CHECK (order_status IN ('order_placed', 'payment_confirmed', 'processing', 'ready_for_dispatch', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'payment_failed', 'refunded')),
      cancellation_reason TEXT,
      internal_notes TEXT,
      reservation_expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS order_status_history (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      note TEXT,
      actor_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 12. order_items
    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
      variant_id TEXT REFERENCES product_variants(id) ON DELETE SET NULL,
      product_name TEXT NOT NULL,
      variant_sku TEXT NOT NULL,
      size TEXT NOT NULL,
      color TEXT NOT NULL,
      unit_price_kobo INTEGER NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      line_total_kobo INTEGER NOT NULL
    );

    -- 13. payments
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      provider TEXT NOT NULL CHECK (provider IN ('paystack', 'flutterwave', 'bank_transfer', 'cash_on_delivery')),
      reference TEXT UNIQUE NOT NULL,
      amount_kobo INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'NGN',
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'awaiting_verification', 'successful', 'failed', 'refunded')),
      gateway_response TEXT DEFAULT '{}',
      verified_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
      verified_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 14. deliveries
    CREATE TABLE IF NOT EXISTS deliveries (
      id TEXT PRIMARY KEY,
      order_id TEXT UNIQUE NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      delivery_fee_kobo INTEGER NOT NULL DEFAULT 0,
      fee_payment_timing TEXT NOT NULL DEFAULT 'pay_on_arrival' CHECK (fee_payment_timing IN ('prepaid', 'pay_on_arrival')),
      delivery_scope TEXT NOT NULL DEFAULT 'nigeria' CHECK (delivery_scope IN ('nigeria', 'international')),
      courier_company TEXT,
      assigned_personnel TEXT,
      tracking_number TEXT,
      estimated_delivery_date TEXT,
      instructions TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready_for_dispatch', 'shipped', 'out_for_delivery', 'delivered', 'cancelled')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 15. coupons & 16. coupon_usage
    CREATE TABLE IF NOT EXISTS coupons (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
      discount_value INTEGER NOT NULL CHECK (discount_value > 0),
      min_purchase_kobo INTEGER NOT NULL DEFAULT 0,
      max_discount_kobo INTEGER,
      usage_limit INTEGER,
      per_customer_limit INTEGER NOT NULL DEFAULT 1,
      used_count INTEGER NOT NULL DEFAULT 0,
      starts_at TEXT,
      expires_at TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS coupon_usage (
      id TEXT PRIMARY KEY,
      coupon_id TEXT NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      customer_email TEXT NOT NULL,
      discount_applied_kobo INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 17. returns & 18. refunds
    CREATE TABLE IF NOT EXISTS returns (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      customer_email TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
      admin_note TEXT,
      reviewed_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS refunds (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      payment_id TEXT REFERENCES payments(id) ON DELETE SET NULL,
      return_id TEXT REFERENCES returns(id) ON DELETE SET NULL,
      amount_kobo INTEGER NOT NULL CHECK (amount_kobo > 0),
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed')),
      provider_reference TEXT,
      processed_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 19. content
    CREATE TABLE IF NOT EXISTS content (
      key TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '{}',
      updated_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 20. store_settings
    CREATE TABLE IF NOT EXISTS store_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT '{}',
      updated_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 21. staff_permissions
    CREATE TABLE IF NOT EXISTS staff_permissions (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      permission TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(profile_id, permission)
    );

    -- 22. admin_activity_logs
    CREATE TABLE IF NOT EXISTS admin_activity_logs (
      id TEXT PRIMARY KEY,
      actor_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
      actor_email TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      details TEXT DEFAULT '{}',
      ip_address TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 23. notifications
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      recipient_type TEXT NOT NULL CHECK (recipient_type IN ('customer', 'admin')),
      recipient_email TEXT,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      channel TEXT NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app', 'email')),
      delivery_status TEXT NOT NULL DEFAULT 'recorded' CHECK (delivery_status IN ('recorded', 'sent', 'not_configured', 'failed')),
      is_read INTEGER NOT NULL DEFAULT 0,
      metadata TEXT DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 24. newsletter_subscribers
    CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL DEFAULT 'subscribed' CHECK (status IN ('subscribed', 'unsubscribed')),
      unsubscribe_token TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Auth support tables (sessions, login rate limit, password resets)
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      scope TEXT NOT NULL CHECK (scope IN ('customer', 'admin')),
      token_hash TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS auth_attempts (
      id TEXT PRIMARY KEY,
      identifier TEXT NOT NULL,
      ip_address TEXT,
      success INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      token_hash TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
    CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
    CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);
    CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
    CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(customer_email);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);
    CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
    CREATE INDEX IF NOT EXISTS idx_logs_created ON admin_activity_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
  `);

  seedBaselineConfiguration();
}

function seedBaselineConfiguration() {
  // Initial 6 categories required by specification
  const initialCategories = [
    {
      name: "Men's Clothing",
      slug: 'mens-clothing',
      description: 'Tailored shirts, structured blazers, and refined everyday essentials.',
      image_url: '/src/assets/images/category_mens_clothing_1795111181472.jpg',
      display_order: 1,
    },
    {
      name: 'Shoes',
      slug: 'shoes',
      description: 'Handcrafted full-grain leather dress shoes, loafers, and boots.',
      image_url: '/src/assets/images/category_mens_shoes_1795111181709.jpg',
      display_order: 2,
    },
    {
      name: 'Accessories',
      slug: 'accessories',
      description: 'Leather belts, dress timepieces, and curated finishing touches.',
      image_url: '/src/assets/images/category_mens_accessories_1795111180716.jpg',
      display_order: 3,
    },
    {
      name: 'New Arrivals',
      slug: 'new-arrivals',
      description: 'Recently curated additions to the Diamond Store collection.',
      image_url: '/src/assets/images/product_tailored_shirt_1795111181466.jpg',
      display_order: 4,
    },
    {
      name: 'Best Sellers',
      slug: 'best-sellers',
      description: 'Signature pieces favored by discerning gentlemen.',
      image_url: '/src/assets/images/product_wool_blazer_1795111181387.jpg',
      display_order: 5,
    },
    {
      name: 'Special Offers',
      slug: 'special-offers',
      description: 'Limited seasonal reductions on selected pieces.',
      image_url: '/src/assets/images/product_leather_derby_1795111181110.jpg',
      display_order: 6,
    },
  ];

  const insertCat = db.prepare(`
    INSERT OR IGNORE INTO categories (id, name, slug, description, image_url, display_order, is_active)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `);
  for (const c of initialCategories) {
    insertCat.run(crypto.randomUUID(), c.name, c.slug, c.description, c.image_url, c.display_order);
  }

  // Baseline Store Settings (Zero invented phone, email, address, social accounts, or couriers)
  const defaultSettings: Record<string, unknown> = {
    general: {
      store_name: 'Diamond Store',
      store_logo_text: 'DIAMOND STORE',
      location: 'Ogbomoso, Oyo State, Nigeria',
      currency: 'NGN',
      timezone: 'Africa/Lagos',
      business_email: '',
      business_phone: '',
      whatsapp_number: '',
      social_links: {
        instagram: '',
        x: '',
        facebook: '',
      },
    },
    delivery: {
      nigeria_enabled: true,
      international_enabled: true,
      default_fee_kobo: 0,
      default_payable_on_arrival: true,
      notes: 'Delivery charges are set per order based on destination. By default, delivery fees are payable on the delivery day.',
    },
    stock: {
      default_low_stock_threshold: 5,
      reservation_minutes: 30,
    },
    orders: {
      order_prefix: 'DS',
      auto_confirm_paid_online: true,
    },
    returns: {
      enabled: false,
      deadline_days: 0,
      conditions: 'Returns are currently disabled for Diamond Store orders. Super Admin may enable and configure return eligibility here.',
    },
    notifications: {
      notify_admin_new_order: true,
      notify_admin_low_stock: true,
      notify_customer_order_updates: true,
    },
    payments: {
      paystack: {
        enabled: false,
        mode: 'test',
        public_key: '',
        webhook_url: '/api/webhooks/paystack',
      },
      flutterwave: {
        enabled: false,
        mode: 'test',
        public_key: '',
        webhook_url: '/api/webhooks/flutterwave',
      },
      bank_transfer: {
        enabled: false,
        bank_name: '',
        account_name: '',
        account_number: '',
        instructions: 'Transfer the exact order total and await confirmation from our team.',
      },
      cash_on_delivery: {
        enabled: true,
        instructions: 'Pay in cash or via confirmed transfer upon delivery.',
        requires_admin_approval: false,
      },
    },
  };

  const insertSetting = db.prepare(`INSERT OR IGNORE INTO store_settings (key, value) VALUES (?, ?)`);
  for (const [key, val] of Object.entries(defaultSettings)) {
    insertSetting.run(key, JSON.stringify(val));
  }

  // Baseline Editable CMS Content
  const defaultContent: Record<string, { title: string; body: unknown }> = {
    announcement_bar: {
      title: 'Announcement Bar',
      body: {
        enabled: true,
        messages: [
          'Curated Menswear, Footwear & Accessories · Ogbomoso, Oyo State, Nigeria',
          'Delivery Available Across Nigeria & Worldwide · Delivery Fee Payable on Delivery Day by Default',
        ],
      },
    },
    hero: {
      title: 'Homepage Hero',
      body: {
        headline: 'DEFINE YOUR STYLE. OWN YOUR CONFIDENCE.',
        description: "Discover premium men's clothing, footwear and accessories, carefully selected to elevate your everyday style.",
        primary_cta_label: 'Shop Now',
        primary_cta_url: '/shop',
        secondary_cta_label: 'Explore Collections',
        secondary_cta_url: '/shop?sort=featured',
        image_url: '/src/assets/images/hero_menswear_editorial_1795111182033.jpg',
      },
    },
    promotional_banner: {
      title: 'Editorial Banner',
      body: {
        enabled: true,
        eyebrow: 'Ogbomoso · Nationwide & International',
        headline: 'Tailored Craftsmanship for Modern Gentlemen',
        description: 'Each garment, pair of leather shoes, and accessory is inspected for lasting drape, stitch integrity, and timeless versatility.',
        cta_label: 'Browse Catalogue',
        cta_url: '/shop',
      },
    },
    about: {
      title: 'About Diamond Store',
      body: {
        headline: 'Crafted Presence, Rooted in Ogbomoso',
        paragraphs: [
          'Diamond Store is an online men’s fashion and accessories house headquartered in Ogbomoso, Oyo State, Nigeria, serving discerning clients across Nigeria and internationally.',
          'Our collection spans structured men’s clothing, handcrafted leather footwear, and considered everyday accessories — chosen for enduring silhouettes, breathable fabrics, and disciplined finishing.',
          'Every order is verified directly by our store operations team with transparent delivery arrangements tailored to your destination.',
        ],
      },
    },
    faq: {
      title: 'Frequently Asked Questions',
      body: {
        items: [
          {
            question: 'Where is Diamond Store located and where do you deliver?',
            answer: 'Diamond Store operates from Ogbomoso, Oyo State, Nigeria. We arrange deliveries across Nigeria and to international destinations subject to destination logistics.',
          },
          {
            question: 'How are delivery charges handled?',
            answer: 'Delivery charges depend on your delivery destination and are set and recorded per order. By default, delivery fees are payable on the delivery day unless arranged as prepaid.',
          },
          {
            question: 'How do I track my order?',
            answer: 'Visit the Track Order page and enter your unique Diamond Store order number together with the email address or phone number used at checkout.',
          },
          {
            question: 'What is your return policy?',
            answer: 'Returns are currently disabled by store policy unless explicitly updated by the Super Admin. Please review sizing and colour specifications carefully before confirming your order.',
          },
        ],
      },
    },
    shipping_policy: {
      title: 'Shipping & Delivery Policy',
      body: {
        sections: [
          {
            heading: 'Coverage',
            text: 'Diamond Store delivers across Nigeria and internationally, subject to available delivery arrangements for the destination country.',
          },
          {
            heading: 'Delivery Fees & Payment Timing',
            text: 'Delivery charges vary by destination and are set per order by our logistics team. By default, delivery fees are payable on the delivery day unless explicitly marked as prepaid on your order.',
          },
          {
            heading: 'Dispatch & Tracking',
            text: 'Once an order is confirmed and prepared in Ogbomoso, tracking details and estimated delivery dates are updated in your account and on the Track Order page.',
          },
        ],
      },
    },
    return_policy: {
      title: 'Return Policy',
      body: {
        text: 'Returns are disabled initially at Diamond Store. Any exceptions or future return eligibility windows are governed exclusively by the store return policy configured by the Super Admin.',
      },
    },
    privacy_policy: {
      title: 'Privacy Policy',
      body: {
        sections: [
          {
            heading: 'Information We Collect',
            text: 'We collect only the customer details required to process orders, coordinate deliveries, manage customer accounts, and send order notifications.',
          },
          {
            heading: 'Data Security',
            text: 'Passwords are encrypted using industry-standard hashing, and payment credentials are never stored in browser-side code.',
          },
        ],
      },
    },
    terms: {
      title: 'Terms & Conditions',
      body: {
        sections: [
          {
            heading: 'Orders & Pricing',
            text: 'All product prices are denominated in Nigerian Naira (NGN/₦). Order totals, discounts, and variant stock availability are verified server-side prior to order confirmation.',
          },
          {
            heading: 'Payments',
            text: 'Online payments are verified server-side with the configured payment gateway before an order is marked as paid.',
          },
        ],
      },
    },
  };

  const insertContent = db.prepare(`INSERT OR IGNORE INTO content (key, title, body) VALUES (?, ?, ?)`);
  for (const [key, item] of Object.entries(defaultContent)) {
    insertContent.run(key, item.title, JSON.stringify(item.body));
  }
}

export function getSetting<T = Record<string, unknown>>(key: string): T | null {
  const row = db.prepare('SELECT value FROM store_settings WHERE key = ?').get(key) as { value: string } | undefined;
  if (!row) return null;
  return JSON.parse(row.value) as T;
}

export function setSetting(key: string, value: unknown, actorId?: string | null) {
  db.prepare(`
    INSERT INTO store_settings (key, value, updated_by, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = datetime('now')
  `).run(key, JSON.stringify(value), actorId ?? null);
}
