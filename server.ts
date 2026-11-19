import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { db, initDatabase } from './server/db';
import { seedDevelopmentCatalog } from './server/seed-dev';
import { publicRouter } from './server/routes/public';
import { authRouter } from './server/routes/auth';
import { adminRouter } from './server/routes/admin';
import { webhooksRouter } from './server/routes/webhooks';

export function createApp() {
  initDatabase();

  if (process.env.NODE_ENV !== 'production' && process.env.ENABLE_DEV_SEED !== 'false') {
    seedDevelopmentCatalog(false);
  }

  const app = express();
  app.set('trust proxy', 1);

  // Capture raw body for Paystack webhook HMAC verification
  app.use(
    express.json({
      limit: '8mb',
      verify: (req, _res, buf) => {
        (req as unknown as { rawBody?: string }).rawBody = buf.toString('utf8');
      },
    })
  );
  app.use(cookieParser());

  // Static uploaded media
  const uploadsDir = path.resolve(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.use('/uploads', express.static(uploadsDir));

  // SEO: robots.txt & dynamic XML sitemap
  app.get('/robots.txt', (req, res) => {
    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    res.type('text/plain').send(
      `User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\nSitemap: ${baseUrl}/sitemap.xml\n`
    );
  });

  app.get('/sitemap.xml', (req, res) => {
    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const staticPaths = [
      '/',
      '/shop',
      '/track-order',
      '/about',
      '/contact',
      '/faq',
      '/shipping-policy',
      '/return-policy',
      '/privacy-policy',
      '/terms',
    ];
    const categories = db
      .prepare('SELECT slug, updated_at FROM categories WHERE is_active = 1')
      .all() as { slug: string; updated_at: string }[];
    const products = db
      .prepare("SELECT slug, updated_at FROM products WHERE status = 'published'")
      .all() as { slug: string; updated_at: string }[];

    const urls = [
      ...staticPaths.map((p) => `<url><loc>${baseUrl}${p}</loc><changefreq>weekly</changefreq></url>`),
      ...categories.map(
        (c) =>
          `<url><loc>${baseUrl}/category/${c.slug}</loc><lastmod>${new Date(c.updated_at).toISOString()}</lastmod></url>`
      ),
      ...products.map(
        (p) =>
          `<url><loc>${baseUrl}/product/${p.slug}</loc><lastmod>${new Date(p.updated_at).toISOString()}</lastmod></url>`
      ),
    ];

    res
      .type('application/xml')
      .send(
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join(
          '\n'
        )}\n</urlset>`
      );
  });

  // API Routes
  app.use('/api', publicRouter);
  app.use('/api', authRouter);
  app.use('/api', webhooksRouter);
  app.use('/api/admin', adminRouter);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', store: 'Diamond Store', timezone: 'Africa/Lagos' });
  });

  return app;
}

async function startServer() {
  const app = createApp();
  const PORT = Number(process.env.PORT || 3000);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Diamond Store server listening on http://0.0.0.0:${PORT}`);
  });
}

const isDirectStart = process.argv[1]?.endsWith('server.ts');
if (isDirectStart) {
  startServer();
}
