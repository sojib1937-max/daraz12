// Admin homepage builder: enable/disable/reorder sections + per-section config.
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { requirePermission } from '../../middleware/adminAuth';
import { audit } from '../../lib/audit';
import { clientIp } from '../../lib/analytics';

export const homepageRouter = Router();

const SECTION_TYPES = [
  'HERO', 'CATEGORIES', 'FEATURED', 'BEST_SELLERS', 'FLASH_SALE', 'TRUST_BADGES',
  'COD_BANNER', 'SOCIAL_PROOF', 'RECOMMENDED', 'REVIEWS', 'FAQ', 'NEWSLETTER', 'PROMO_BANNER',
];

homepageRouter.get('/', requirePermission('homepage.manage'), async (_req, res) => {
  const sections = await prisma.homepageSection.findMany({ orderBy: { sortOrder: 'asc' } });
  res.json({ success: true, data: sections });
});

const sectionSchema = z.object({
  type: z.enum(SECTION_TYPES as [string, ...string[]]),
  title: z.string().max(120).optional().nullable(),
  titleAr: z.string().max(120).optional().nullable(),
  subtitle: z.string().max(300).optional().nullable(),
  subtitleAr: z.string().max(300).optional().nullable(),
  config: z.record(z.unknown()).optional(),
  sortOrder: z.coerce.number().int().default(0),
  isEnabled: z.boolean().default(true),
});

homepageRouter.post('/', requirePermission('homepage.manage'), async (req, res) => {
  const data = sectionSchema.parse(req.body);
  const section = await prisma.homepageSection.create({ data: { ...data, config: (data.config || {}) as never } });
  res.status(201).json({ success: true, data: section });
});

homepageRouter.patch('/:id', requirePermission('homepage.manage'), async (req, res) => {
  const data = sectionSchema.partial().parse(req.body);
  await prisma.homepageSection.update({ where: { id: Number(req.params.id) }, data: { ...data, config: data.config as never } });
  res.json({ success: true, data: { message: 'Section updated' } });
});

homepageRouter.delete('/:id', requirePermission('homepage.manage'), async (req, res) => {
  await prisma.homepageSection.delete({ where: { id: Number(req.params.id) } });
  res.json({ success: true, data: { message: 'Section deleted' } });
});

// Reorder: [{id, sortOrder}]
homepageRouter.put('/reorder', requirePermission('homepage.manage'), async (req, res) => {
  const items = z.array(z.object({ id: z.number().int(), sortOrder: z.coerce.number().int() })).parse(req.body);
  await prisma.$transaction(items.map((i) => prisma.homepageSection.update({ where: { id: i.id }, data: { sortOrder: i.sortOrder } })));
  await audit({ adminId: res.locals.admin.id, adminName: res.locals.admin.name, action: 'HOMEPAGE_REORDERED', entityType: 'HomepageSection', details: { items: items.length }, ip: clientIp(req) });
  res.json({ success: true, data: { message: 'Sections reordered' } });
});
