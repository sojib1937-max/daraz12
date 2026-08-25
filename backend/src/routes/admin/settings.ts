// Admin settings: read/write store settings (whitelisted keys only).
import { Router } from 'express';
import { z } from 'zod';
import { getAllSettings, setSettingsBulk, DEFAULT_SETTINGS } from '../../lib/settings';
import { requirePermission } from '../../middleware/adminAuth';
import { audit } from '../../lib/audit';
import { clientIp } from '../../lib/analytics';

export const settingsRouter = Router();

// Only these groups/keys can be written by admins (defense in depth).
const WRITABLE_PREFIXES = [
  'store.', 'shipping.', 'orders.', 'announcement.', 'popups.', 'theme.', 'seo.',
  'social.', 'footer.', 'checkout.', 'notifications.', 'analytics.', 'fraud.',
  'maintenance.', 'email.', 'sms.', 'whatsapp.',
];

function isWritable(key: string): boolean {
  return WRITABLE_PREFIXES.some((p) => key.startsWith(p));
}

settingsRouter.get('/', requirePermission('settings.view'), async (_req, res) => {
  const all = await getAllSettings();
  res.json({ success: true, data: all });
});

settingsRouter.put('/', requirePermission('settings.update'), async (req, res) => {
  const entries = z
    .array(z.object({ key: z.string().min(2).max(80), value: z.unknown() }))
    .max(200)
    .parse(req.body);

  const rejected: string[] = [];
  const toSave = entries.filter((e) => {
    if (!isWritable(e.key)) {
      rejected.push(e.key);
      return false;
    }
    return true;
  });

  await setSettingsBulk(toSave.map((e) => ({ key: e.key, value: e.value as never, group: e.key.split('.')[0], isPublic: isPublicKey(e.key) })));
  await audit({
    adminId: res.locals.admin.id, adminName: res.locals.admin.name, action: 'SETTINGS_CHANGED',
    entityType: 'StoreSetting', details: { keys: toSave.map((e) => e.key), rejected },
    ip: clientIp(req),
  });
  res.json({ success: true, data: { saved: toSave.map((e) => e.key), rejected, defaults: DEFAULT_SETTINGS } });
});

function isPublicKey(key: string): boolean {
  return [
    'store.name', 'store.nameAr', 'store.tagline', 'store.logo', 'store.favicon', 'store.email', 'store.phone', 'store.whatsapp',
    'store.currency', 'store.country', 'store.defaultLanguage', 'store.workingHours', 'store.address',
    'shipping.zones', 'shipping.freeShippingThreshold', 'shipping.minOrderAmount', 'shipping.deliveryEstimateDays', 'shipping.codAvailable',
    'orders.prefix', 'announcement.', 'popups.', 'theme.', 'seo.', 'social.', 'footer.', 'checkout.',
    'analytics.gaId', 'analytics.metaPixelId', 'analytics.tiktokPixelId', 'maintenance.enabled', 'maintenance.message',
  ].some((p) => (p.endsWith('.') ? key.startsWith(p) : key === p));
}
