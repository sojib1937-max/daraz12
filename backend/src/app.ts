// App assembly: express app with security headers, CORS, body parsing,
// rate limiting, CSRF, routes, error handling.
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';
import { config, isAllowedOrigin } from './config';
import { prisma } from './lib/prisma';
import { globalLimiter } from './lib/rateLimit';
import { csrfIssuer, csrfProtect } from './middleware/csrf';
import { errorHandler } from './lib/errors';
import { ZodError } from 'zod';
import { logger } from './lib/logger';
import { clientIp } from './lib/analytics';

// Routes
import { authRouter } from './routes/auth';
import { publicRouter } from './routes/public';
import { checkoutRouter } from './routes/checkout';
import { customerRouter } from './routes/customer';
import { eventsRouter } from './routes/events';
import { adminRouter } from './routes/admin';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: false, // frontend manages CSP (needs inline styles for preview)
      crossOriginEmbedderPolicy: false,
    })
  );

  // CORS — dev: explicit allowlist; prod: same-origin via reverse proxy
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin || isAllowedOrigin(origin)) return cb(null, true);
        logger.warn('CORS blocked origin', { origin });
        return cb(null, false);
      },
      credentials: true,
    })
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());

  // Simple request logger (no bodies)
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      if (req.path.startsWith('/api/')) {
        logger.debug(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`);
      }
    });
    next();
  });

  // Serve uploaded media (local storage driver)
  if (config.storageDriver === 'local') {
    fs.mkdirSync(config.storageLocalDir, { recursive: true });
    app.use(
      config.storageBaseUrl,
      express.static(config.storageLocalDir, {
        maxAge: '30d',
        immutable: false,
        setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
      })
    );
  }

  // Rate limit everything under /api
  app.use('/api', globalLimiter);

  // CSRF token issuance + protection for API state changes
  app.use('/api', csrfIssuer, csrfProtect);

  // Request id for logs
  app.use((req, res, next) => {
    res.locals.reqId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    res.setHeader('X-Request-Id', res.locals.reqId);
    next();
  });

  // Health
  app.get('/api/health', (_req, res) => {
    res.json({ success: true, data: { status: 'ok', time: new Date().toISOString(), demoMode: config.demoMode, ip: clientIp(_req) } });
  });

  // SEO: sitemap + robots at the site root (where search engines expect them)
  app.get('/sitemap.xml', async (_req, res) => {
    const base = config.appUrl.replace(/\/$/, '');
    const [products, categories] = await Promise.all([
      prisma.product.findMany({ where: { status: 'PUBLISHED', deletedAt: null }, select: { slug: true, updatedAt: true } }),
      prisma.category.findMany({ where: { isActive: true, deletedAt: null }, select: { slug: true, updatedAt: true } }),
    ]);
    const staticPaths = ['', '/shop', '/about', '/contact', '/faq', '/shipping-policy', '/return-policy', '/privacy-policy', '/terms', '/track-order', '/cart', '/checkout'];
    const now = new Date().toISOString();
    const urls = [
      ...staticPaths.map((p) => `<url><loc>${base}${p}</loc><lastmod>${now}</lastmod><changefreq>daily</changefreq><priority>0.8</priority></url>`),
      ...products.map((p) => `<url><loc>${base}/product/${p.slug}</loc><lastmod>${p.updatedAt.toISOString()}</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>`),
      ...categories.map((c) => `<url><loc>${base}/category/${c.slug}</loc><lastmod>${now}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`),
    ];
    res.setHeader('Content-Type', 'application/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`);
  });

  app.get('/robots.txt', (_req, res) => {
    res.setHeader('Content-Type', 'text/plain');
    res.send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /account\nDisallow: /checkout\n\nSitemap: ${config.appUrl}/sitemap.xml\n`);
  });

  // Public / customer routes
  app.use('/api/auth', authRouter);
  app.use('/api', publicRouter);
  app.use('/api/checkout', checkoutRouter);
  app.use('/api', customerRouter);
  app.use('/api/events', eventsRouter);

  // Admin API — authentication + RBAC enforced inside adminRouter
  app.use(`/api/admin`, adminRouter);

  // Static frontend (production single-server mode): serve built frontend if present
  const frontendDist = path.resolve(__dirname, '../../frontend/dist');
  if (fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist, { index: false, maxAge: '1h' }));
    // SPA fallback for non-API routes
    app.get(/^(?!\/api\/|\/uploads\/|\/assets\/).*/, (_req, res) => {
      res.sendFile(path.join(frontendDist, 'index.html'));
    });
  }

  // 404 for unknown API routes
  app.use('/api', (_req, res) => {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'API route not found' } });
  });

  // Central error handler — never leaks internals (handles AppError, ZodError,
  // Prisma known errors, Multer errors, and unknown 500s).
  app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    errorHandler(err, req, res, _next);
  });

  return app;
}
