// Store settings — key/value, admin-editable, cached in memory for hot reads.
import { prisma } from './prisma';
import { config } from '../config';
import { logger } from './logger';

export type SettingValue = string | number | boolean | Record<string, unknown> | unknown[];

export const DEFAULT_SETTINGS: Record<string, SettingValue> = {
  // Store identity
  'store.name': 'Virexamart',
  'store.nameAr': 'فيريكسامارت',
  'store.tagline': 'Premium products. Cash on delivery across the UAE.',
  'store.logo': '/images/logo-virexamart.png',
  'store.favicon': '',
  'store.email': 'support@virexamart.com',
  'store.phone': '+971 50 000 0000',
  'store.whatsapp': '971500000000', // digits only, international format
  'store.currency': 'AED',
  'store.country': 'United Arab Emirates',
  'store.defaultLanguage': 'en',
  'store.address': 'Business Bay, Dubai, UAE',
  'store.workingHours': 'Sat–Thu 9:00 AM – 9:00 PM',

  // Shipping & COD
  'shipping.zones': [
    { name: 'Dubai', emirates: ['DUBAI'], fee: 15, codFee: 0, isActive: true },
    { name: 'Other Emirates', emirates: ['ABU_DHABI', 'SHARJAH', 'AJMAN', 'UMM_AL_QUWAIN', 'RAS_AL_KHAIMAH', 'FUJAIRAH'], fee: 25, codFee: 0, isActive: true },
  ],
  'shipping.freeShippingThreshold': 199,
  'shipping.minOrderAmount': 0,
  'shipping.deliveryEstimateDays': '1-3 business days',
  'shipping.codAvailable': true,

  // Orders
  'orders.prefix': 'DXB',
  'orders.autoConfirm': false,

  // Announcement bar
  'announcement.enabled': true,
  'announcement.text': '🔥 Free shipping on orders over AED 199 • Cash on Delivery across the UAE',
  'announcement.textAr': '🔥 شحن مجاني للطلبات فوق 199 درهم • الدفع عند الاستلام في جميع أنحاء الإمارات',
  'announcement.link': '',

  // Popups — real social proof (only real DB orders, masked)
  'popups.salesEnabled': true,
  'popups.salesIntervalSec': 45,
  'popups.salesDurationMs': 8000,
  'popups.salesMaxPerDay': 25,
  'popups.salesMaskNames': true,
  'popups.salesUseDemoWhenEmpty': true, // in DEMO_MODE only: show demo orders when no real orders yet

  // Discount popup
  'popups.discountEnabled': true,
  'popups.discountTitle': 'Get 10% off your first order',
  'popups.discountTitleAr': 'احصل على خصم 10% على طلبك الأول',
  'popups.discountCode': 'WELCOME10',
  'popups.discountDelaySec': 12,
  'popups.discountFrequencyDays': 2,
  'popups.exitIntentEnabled': false,

  // Newsletter popup
  'popups.newsletterEnabled': true,
  'popups.newsletterDelaySec': 30,
  'popups.newsletterFrequencyDays': 7,

  // Theme
  'theme.primaryColor': '#0f5132', // deep emerald — premium Gulf feel
  'theme.accentColor': '#c8a24b', // gold
  'theme.rounded': 'lg',

  // SEO
  'seo.title': 'Virexamart — UAE Online Shopping with Cash on Delivery',
  'seo.titleAr': 'فيريكسامارت — تسوق أونلاين في الإمارات مع الدفع عند الاستلام',
  'seo.description':
    'Shop premium products online in Dubai & UAE. Fast delivery to all 7 emirates. Cash on Delivery available on every order.',
  'seo.descriptionAr':
    'تسوق أفضل المنتجات أونلاين في دبي والإمارات. توصيل سريع لجميع الإمارات السبع. الدفع عند الاستلام متاح على كل طلب.',
  'seo.keywords': 'online shopping UAE, cash on delivery Dubai, COD UAE, Virexamart',
  'seo.ogImage': '',

  // Social links
  'social.instagram': 'https://instagram.com/',
  'social.tiktok': 'https://tiktok.com/',
  'social.facebook': 'https://facebook.com/',
  'social.youtube': '',
  'social.twitter': '',

  // Footer
  'footer.aboutText':
    'Virexamart brings you hand-picked premium products with fast delivery across the UAE and cash on delivery on every order.',
  'footer.aboutTextAr':
    'فيريكسامارت يقدم لك منتجات مميزة مختارة بعناية مع توصيل سريع في جميع أنحاء الإمارات والدفع عند الاستلام على كل طلب.',
  'footer.copyright': '© {year} Virexamart. All rights reserved.',
  'footer.copyrightAr': '© {year} فيريكسامارت. جميع الحقوق محفوظة.',

  // Checkout
  'checkout.emailRequired': false,
  'checkout.notesEnabled': true,

  // Admin notifications
  'notifications.soundEnabled': true,
  'notifications.adminNewOrderEnabled': true,
  'notifications.lowStockEnabled': true,

  // Analytics IDs (public-safe — injected into <head> by frontend)
  'analytics.gaId': '',
  'analytics.metaPixelId': '',
  'analytics.tiktokPixelId': '',

  // Fraud rules (configurable)
  'fraud.duplicateWindowHours': config.fraud.duplicateWindowHours,
  'fraud.duplicateMaxOrders': config.fraud.duplicateMaxOrders,
  'fraud.flagHighValueOrdersAbove': 1000,

  // Maintenance
  'maintenance.enabled': false,
  'maintenance.message': 'We are performing scheduled maintenance. Please check back soon.',
};

let cache: Record<string, SettingValue> | null = null;
let cachePromise: Promise<Record<string, SettingValue>> | null = null;

/** Invalidate the in-memory cache (used after direct DB writes in tests/scripts). */
export function resetSettingsCache() {
  cache = null;
  cachePromise = null;
}

async function loadAll(): Promise<Record<string, SettingValue>> {
  const rows = await prisma.storeSetting.findMany();
  const merged: Record<string, SettingValue> = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    try {
      merged[row.key] = row.value as SettingValue;
    } catch {
      logger.warn('Skipping invalid setting value', { key: row.key });
    }
  }
  return merged;
}

export function getAllSettings(): Promise<Record<string, SettingValue>> {
  if (cache) return Promise.resolve(cache);
  if (!cachePromise) {
    cachePromise = loadAll().then((s) => {
      cache = s;
      cachePromise = null;
      return s;
    });
  }
  return cachePromise;
}

export async function getSetting<T = SettingValue>(key: string): Promise<T> {
  const all = await getAllSettings();
  return (all[key] ?? DEFAULT_SETTINGS[key]) as T;
}

export async function getSettingsBulk(keys: string[]): Promise<Record<string, SettingValue>> {
  const all = await getAllSettings();
  const out: Record<string, SettingValue> = {};
  for (const k of keys) out[k] = all[k] ?? DEFAULT_SETTINGS[k];
  return out;
}

export async function setSetting(key: string, value: SettingValue, group = 'general', isPublic = false) {
  await prisma.storeSetting.upsert({
    where: { key },
    create: { key, value: value as never, group, isPublic },
    update: { value: value as never, group, isPublic },
  });
  // Invalidate cache
  cache = null;
}

export async function setSettingsBulk(entries: { key: string; value: SettingValue; group?: string; isPublic?: boolean }[]) {
  for (const e of entries) {
    await prisma.storeSetting.upsert({
      where: { key: e.key },
      create: { key: e.key, value: e.value as never, group: e.group || 'general', isPublic: e.isPublic ?? false },
      update: { value: e.value as never, group: e.group || 'general', isPublic: e.isPublic ?? false },
    });
  }
  cache = null;
}

/** Public subset exposed to the storefront (no admin-only values). */
const PUBLIC_KEYS = [
  'store.name', 'store.nameAr', 'store.tagline', 'store.logo', 'store.favicon', 'store.email', 'store.phone',
  'store.whatsapp', 'store.currency', 'store.country', 'store.defaultLanguage', 'store.workingHours',
  'shipping.zones', 'shipping.freeShippingThreshold', 'shipping.minOrderAmount', 'shipping.deliveryEstimateDays',
  'shipping.codAvailable',
  'orders.prefix',
  'announcement.enabled', 'announcement.text', 'announcement.textAr', 'announcement.link',
  'popups.salesEnabled', 'popups.salesIntervalSec', 'popups.salesDurationMs', 'popups.salesMaxPerDay', 'popups.salesMaskNames',
  'popups.discountEnabled', 'popups.discountTitle', 'popups.discountTitleAr', 'popups.discountCode', 'popups.discountDelaySec', 'popups.discountFrequencyDays', 'popups.exitIntentEnabled',
  'popups.newsletterEnabled', 'popups.newsletterDelaySec', 'popups.newsletterFrequencyDays',
  'theme.primaryColor', 'theme.accentColor', 'theme.rounded',
  'seo.title', 'seo.titleAr', 'seo.description', 'seo.descriptionAr', 'seo.keywords', 'seo.ogImage',
  'social.instagram', 'social.tiktok', 'social.facebook', 'social.youtube', 'social.twitter',
  'footer.aboutText', 'footer.aboutTextAr', 'footer.copyright', 'footer.copyrightAr',
  'checkout.emailRequired', 'checkout.notesEnabled',
  'analytics.gaId', 'analytics.metaPixelId', 'analytics.tiktokPixelId',
  'maintenance.enabled', 'maintenance.message',
];

export async function getPublicSettings() {
  const all = await getAllSettings();
  const out: Record<string, SettingValue> = {};
  for (const k of PUBLIC_KEYS) out[k] = all[k];
  return { ...out, demoMode: config.demoMode };
}
