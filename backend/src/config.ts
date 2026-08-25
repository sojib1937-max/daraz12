import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

function int(v: string | undefined, def: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : def;
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  isDev: process.env.NODE_ENV !== 'production',
  port: int(process.env.PORT, 4000),

  databaseUrl: process.env.DATABASE_URL || '',

  appUrl: process.env.APP_URL || 'http://localhost:5173',
  apiUrl: process.env.API_URL || 'http://localhost:4000',
  // Comma separated list of allowed origins for CORS (dev). In production the
  // frontend and API are served from the same origin (reverse proxy) so CORS is
  // effectively same-origin and this list is only used for development.
  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  adminBasePath: process.env.ADMIN_BASE_PATH || '/admin',

  sessionSecret: process.env.SESSION_SECRET || 'dev-session-secret-change-me',
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  cookieSameSite: (process.env.COOKIE_SAME_SITE || (process.env.NODE_ENV === 'production' ? 'lax' : 'lax')) as 'lax' | 'strict' | 'none',

  // Sessions
  adminSessionDays: int(process.env.ADMIN_SESSION_DAYS, 3),
  customerSessionDays: int(process.env.CUSTOMER_SESSION_DAYS, 30),
  resetTokenMinutes: int(process.env.RESET_TOKEN_MINUTES, 30),

  demoMode: process.env.DEMO_MODE === 'true',
  seedAdminEmail: process.env.SEED_ADMIN_EMAIL || 'admin@desertcart.ae',
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD || 'Admin@12345',

  // Storage
  storageDriver: process.env.STORAGE_DRIVER || 'local', // local | s3
  storageLocalDir: process.env.STORAGE_LOCAL_DIR || path.resolve(__dirname, '../../uploads'),
  storageBaseUrl: process.env.STORAGE_BASE_URL || '/uploads',
  s3: {
    region: process.env.S3_REGION || '',
    bucket: process.env.S3_BUCKET || '',
    accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
    endpoint: process.env.S3_ENDPOINT || undefined,
    publicBaseUrl: process.env.S3_PUBLIC_BASE_URL || '',
  },

  uploadMaxMb: int(process.env.UPLOAD_MAX_MB, 8),

  // Notifications
  email: {
    driver: process.env.EMAIL_DRIVER || 'console', // console | smtp
    from: process.env.EMAIL_FROM || 'DesertCart <no-reply@desertcart.ae>',
    smtpHost: process.env.SMTP_HOST || '',
    smtpPort: int(process.env.SMTP_PORT, 587),
    smtpUser: process.env.SMTP_USER || '',
    smtpPass: process.env.SMTP_PASS || '',
    smtpSecure: process.env.SMTP_SECURE === 'true',
  },
  sms: {
    driver: process.env.SMS_DRIVER || 'console', // console | http
    webhookUrl: process.env.SMS_WEBHOOK_URL || '',
    apiKey: process.env.SMS_API_KEY || '',
    from: process.env.SMS_FROM || 'DesertCart',
  },
  whatsapp: {
    driver: process.env.WHATSAPP_DRIVER || 'console', // console | http
    webhookUrl: process.env.WHATSAPP_WEBHOOK_URL || '',
    apiKey: process.env.WHATSAPP_API_KEY || '',
  },

  // Analytics
  gaId: process.env.ANALYTICS_GA_ID || '',
  metaPixelId: process.env.ANALYTICS_META_PIXEL_ID || '',

  // Security
  rateLimit: {
    globalWindowMs: int(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    globalMax: int(process.env.RATE_LIMIT_GLOBAL_MAX, 600),
    authWindowMs: int(process.env.RATE_LIMIT_AUTH_WINDOW_MS, 15 * 60 * 1000),
    authMax: int(process.env.RATE_LIMIT_AUTH_MAX, 15),
    orderWindowMs: 10 * 60 * 1000,
    orderMax: int(process.env.RATE_LIMIT_ORDER_MAX, 10),
  },

  // Fraud detection defaults (overridable via settings)
  fraud: {
    duplicateWindowHours: int(process.env.FRAUD_DUPLICATE_WINDOW_HOURS, 6),
    duplicateMaxOrders: int(process.env.FRAUD_DUPLICATE_MAX_ORDERS, 2),
  },
};

export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  // Explicitly configured origins always allowed (dev AND split hosting,
  // e.g. Netlify frontend → Render backend).
  if (config.allowedOrigins.includes(origin)) return true;
  if (config.isProd) {
    // Same-origin: the API is served by the same host as the frontend.
    const app = config.appUrl.replace(/\/$/, '');
    if (origin === app) return true;
    // www + root variants of the app domain
    if (app.startsWith('https://')) {
      const host = app.replace('https://', '');
      if (origin === `https://${host}` || origin === `https://www.${host}`) return true;
    }
    return false;
  }
  // Development: allow all origins (localhost, preview hosts). CORS headers are
  // only a browser convenience in dev — the API is still protected by sessions,
  // CSRF tokens, rate limiting and validation.
  return true;
}
