import crypto from 'crypto';
import { db, initDatabase } from './db';

/**
 * Safe Development Seed Script
 * Populates sample men's clothing, shoes, and accessories products with independent
 * variant inventory so development/preview environments can be tested end-to-end.
 * Intentionally avoids inventing any business phone, email, street address, social links, or courier APIs.
 */
export function seedDevelopmentCatalog(force = false): { seeded: boolean; count: number } {
  initDatabase();

  const existing = db.prepare('SELECT COUNT(*) as c FROM products').get() as { c: number };
  if (existing.c > 0 && !force) {
    return { seeded: false, count: existing.c };
  }

  const getCategoryId = (slug: string): string | null => {
    const row = db.prepare('SELECT id FROM categories WHERE slug = ?').get(slug) as { id: string } | undefined;
    return row?.id ?? null;
  };

  const clothingCat = getCategoryId('mens-clothing');
  const shoesCat = getCategoryId('shoes');
  const accessoriesCat = getCategoryId('accessories');

  const sampleProducts = [
    {
      name: 'Ogbomoso Loomed Linen-Cotton Shirt',
      slug: 'ogbomoso-loomed-linen-cotton-shirt',
      sku: 'DS-CL-SHIRT-001',
      category_id: clothingCat,
      description:
        'Cut from breathable long-staple linen-cotton blend with genuine mother-of-pearl buttons, single-needle side seams, and a structured spread collar tailored for warm Nigerian afternoons and formal evenings alike.',
      regular_price_kobo: 4800000, // ₦48,000
      sale_price_kobo: null,
      is_featured: 1,
      is_bestseller: 1,
      status: 'published',
      images: [
        { url: '/src/assets/images/product_tailored_shirt_1795111181466.jpg', alt_text: 'Ivory tailored linen-cotton dress shirt' },
        { url: '/src/assets/images/category_mens_clothing_1795111181472.jpg', alt_text: 'Tailored shirt collection view' },
      ],
      variants: [
        { sku: 'DS-CL-SHIRT-001-IVR-M', size: 'M', color: 'Ivory', color_hex: '#F7F5F0', stock: 12 },
        { sku: 'DS-CL-SHIRT-001-IVR-L', size: 'L', color: 'Ivory', color_hex: '#F7F5F0', stock: 15 },
        { sku: 'DS-CL-SHIRT-001-IVR-XL', size: 'XL', color: 'Ivory', color_hex: '#F7F5F0', stock: 8 },
        { sku: 'DS-CL-SHIRT-001-CHR-L', size: 'L', color: 'Charcoal', color_hex: '#2B323A', stock: 6 },
      ],
    },
    {
      name: 'Midnight Merino Single-Breasted Blazer',
      slug: 'midnight-merino-single-breasted-blazer',
      sku: 'DS-CL-BLAZER-002',
      category_id: clothingCat,
      description:
        'Half-canvassed tailored blazer crafted from fine breathable merino wool with clean notch lapels, horn buttons with subtle brushed gold detailing, and structured shoulders.',
      regular_price_kobo: 16500000, // ₦165,000
      sale_price_kobo: 14500000, // ₦145,000
      is_featured: 1,
      is_bestseller: 1,
      status: 'published',
      images: [
        { url: '/src/assets/images/product_wool_blazer_1795111181387.jpg', alt_text: 'Midnight black merino wool single-breasted blazer' },
        { url: '/src/assets/images/hero_menswear_editorial_1795111182033.jpg', alt_text: 'Editorial fit of midnight wool blazer' },
      ],
      variants: [
        { sku: 'DS-CL-BLAZER-002-BLK-48', size: '48', color: 'Midnight Black', color_hex: '#101820', stock: 5 },
        { sku: 'DS-CL-BLAZER-002-BLK-50', size: '50', color: 'Midnight Black', color_hex: '#101820', stock: 9 },
        { sku: 'DS-CL-BLAZER-002-BLK-52', size: '52', color: 'Midnight Black', color_hex: '#101820', stock: 4 },
      ],
    },
    {
      name: 'Goodyear-Welted Calfskin Derby Shoes',
      slug: 'goodyear-welted-calfskin-derby-shoes',
      sku: 'DS-SH-DERBY-003',
      category_id: shoesCat,
      description:
        'Handcrafted from supple full-grain calfskin leather with vegetable-tanned leather lining, stacked heel, and storm-welted sole engineered for enduring comfort and resoling longevity.',
      regular_price_kobo: 11200000, // ₦112,000
      sale_price_kobo: null,
      is_featured: 1,
      is_bestseller: 1,
      status: 'published',
      images: [
        { url: '/src/assets/images/product_leather_derby_1795111181110.jpg', alt_text: 'Handcrafted black calfskin Derby dress shoes' },
        { url: '/src/assets/images/category_mens_shoes_1795111181709.jpg', alt_text: 'Derby and loafer footwear lineup' },
      ],
      variants: [
        { sku: 'DS-SH-DERBY-003-BLK-42', size: '42', color: 'Midnight Black', color_hex: '#101820', stock: 7 },
        { sku: 'DS-SH-DERBY-003-BLK-43', size: '43', color: 'Midnight Black', color_hex: '#101820', stock: 10 },
        { sku: 'DS-SH-DERBY-003-ESP-44', size: '44', color: 'Espresso Brown', color_hex: '#4A2E20', stock: 6 },
        { sku: 'DS-SH-DERBY-003-ESP-45', size: '45', color: 'Espresso Brown', color_hex: '#4A2E20', stock: 3 },
      ],
    },
    {
      name: 'Sovereign Gold-Case Dress Watch',
      slug: 'sovereign-gold-case-dress-watch',
      sku: 'DS-AC-WATCH-004',
      category_id: accessoriesCat,
      description:
        'Slim 39mm dress timepiece pairing a brushed warm gold stainless steel case, deep midnight sunray dial, applied baton indices, and a supple stitched espresso calfskin strap.',
      regular_price_kobo: 13500000, // ₦135,000
      sale_price_kobo: 11800000, // ₦118,000
      is_featured: 1,
      is_bestseller: 0,
      status: 'published',
      images: [
        { url: '/src/assets/images/product_chronograph_watch_1795111180492.jpg', alt_text: 'Gold-case dress watch on leather strap' },
        { url: '/src/assets/images/category_mens_accessories_1795111180716.jpg', alt_text: 'Men accessories flatlay with dress watch' },
      ],
      variants: [
        { sku: 'DS-AC-WATCH-004-ESP-39', size: '39mm', color: 'Espresso / Gold', color_hex: '#D6B875', stock: 8 },
        { sku: 'DS-AC-WATCH-004-BLK-39', size: '39mm', color: 'Black / Gold', color_hex: '#101820', stock: 4 },
      ],
    },
    {
      name: 'Brushed Brass Full-Grain Dress Belt & Cardholder Set',
      slug: 'brushed-brass-full-grain-dress-belt',
      sku: 'DS-AC-BELT-005',
      category_id: accessoriesCat,
      description:
        'Full-grain vegetable-tanned leather belt anchored by a solid brushed champagne-brass buckle, paired with hand-burnished edges for formal suiting and chinos.',
      regular_price_kobo: 3600000, // ₦36,000
      sale_price_kobo: 3100000, // ₦31,000
      is_featured: 0,
      is_bestseller: 1,
      status: 'published',
      images: [
        { url: '/src/assets/images/category_mens_accessories_1795111180716.jpg', alt_text: 'Full-grain leather belt with brushed brass buckle' },
      ],
      variants: [
        { sku: 'DS-AC-BELT-005-ESP-32', size: '32', color: 'Espresso Brown', color_hex: '#4A2E20', stock: 14 },
        { sku: 'DS-AC-BELT-005-ESP-34', size: '34', color: 'Espresso Brown', color_hex: '#4A2E20', stock: 11 },
        { sku: 'DS-AC-BELT-005-BLK-36', size: '36', color: 'Midnight Black', color_hex: '#101820', stock: 9 },
      ],
    },
    {
      name: 'Suede Penny Loafers — Heritage Last',
      slug: 'suede-penny-loafers-heritage-last',
      sku: 'DS-SH-LOAFER-006',
      category_id: shoesCat,
      description:
        'Unlined Italian-style suede penny loafers sculpted on an almond-toe last with flexible Blake-stitched leather soles for effortless warm-weather tailoring.',
      regular_price_kobo: 9500000, // ₦95,000
      sale_price_kobo: null,
      is_featured: 1,
      is_bestseller: 0,
      status: 'published',
      images: [
        { url: '/src/assets/images/category_mens_shoes_1795111181709.jpg', alt_text: 'Suede penny loafers and leather shoes' },
      ],
      variants: [
        { sku: 'DS-SH-LOAFER-006-ESP-41', size: '41', color: 'Cocoa Suede', color_hex: '#5D4037', stock: 6 },
        { sku: 'DS-SH-LOAFER-006-ESP-42', size: '42', color: 'Cocoa Suede', color_hex: '#5D4037', stock: 9 },
        { sku: 'DS-SH-LOAFER-006-BLK-43', size: '43', color: 'Midnight Suede', color_hex: '#101820', stock: 5 },
      ],
    },
  ];

  const tx = db.transaction(() => {
    const insertProd = db.prepare(`
      INSERT OR IGNORE INTO products (id, category_id, name, slug, sku, description, regular_price_kobo, sale_price_kobo, is_featured, is_bestseller, status, low_stock_threshold)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 4)
    `);
    const insertImg = db.prepare(`
      INSERT INTO product_images (id, product_id, url, alt_text, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `);
    const insertVariant = db.prepare(`
      INSERT INTO product_variants (id, product_id, sku, size, color, color_hex, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `);
    const insertInv = db.prepare(`
      INSERT INTO inventory (id, variant_id, quantity_on_hand, quantity_reserved, low_stock_threshold)
      VALUES (?, ?, ?, 0, 4)
    `);
    const insertMovement = db.prepare(`
      INSERT INTO inventory_movements (id, variant_id, delta, reason, reference_id)
      VALUES (?, ?, ?, 'initial_dev_seed', 'seed-dev')
    `);

    for (const p of sampleProducts) {
      const prodId = crypto.randomUUID();
      const info = insertProd.run(
        prodId,
        p.category_id,
        p.name,
        p.slug,
        p.sku,
        p.description,
        p.regular_price_kobo,
        p.sale_price_kobo,
        p.is_featured,
        p.is_bestseller,
        p.status
      );
      if (info.changes === 0) continue;

      p.images.forEach((img, idx) => {
        insertImg.run(crypto.randomUUID(), prodId, img.url, img.alt_text, idx);
      });

      for (const v of p.variants) {
        const varId = crypto.randomUUID();
        insertVariant.run(varId, prodId, v.sku, v.size, v.color, v.color_hex);
        insertInv.run(crypto.randomUUID(), varId, v.stock);
        insertMovement.run(crypto.randomUUID(), varId, v.stock);
      }
    }

    // Seed one sample dev coupon
    db.prepare(`
      INSERT OR IGNORE INTO coupons (id, code, discount_type, discount_value, min_purchase_kobo, max_discount_kobo, usage_limit, per_customer_limit, is_active)
      VALUES (?, 'DIAMOND10', 'percentage', 10, 2000000, 3000000, 100, 2, 1)
    `).run(crypto.randomUUID());
  });

  tx();
  const after = db.prepare('SELECT COUNT(*) as c FROM products').get() as { c: number };
  return { seeded: true, count: after.c };
}

// Allow running directly via `npm run seed:dev`
const isDirectRun = process.argv[1]?.endsWith('seed-dev.ts');
if (isDirectRun) {
  const res = seedDevelopmentCatalog(false);
  console.log('Diamond Store Dev Seed:', res);
}
