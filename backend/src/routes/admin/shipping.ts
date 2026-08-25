// Admin shipping management: zones (per emirate fees) + rules + settings.
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { requirePermission } from '../../middleware/adminAuth';
import { validateBody } from '../../middleware/validate';
import { audit } from '../../lib/audit';
import { clientIp } from '../../lib/analytics';
import { EMIRATES } from '../../lib/helpers';

export const shippingRouter = Router();

shippingRouter.get('/', requirePermission('shipping.manage'), async (_req, res) => {
  const [zones, rules] = await Promise.all([
    prisma.shippingZone.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.shippingRule.findMany({ orderBy: { id: 'asc' } }),
  ]);
  res.json({
    success: true,
    data: {
      emirates: EMIRATES,
      zones: zones.map((z) => ({ id: z.id, name: z.name, emirates: z.emirates, fee: Number(z.fee), codFee: Number(z.codFee), isActive: z.isActive, sortOrder: z.sortOrder })),
      rules: rules.map((r) => ({ id: r.id, name: r.name, ruleType: r.ruleType, value: Number(r.value), isActive: r.isActive })),
    },
  });
});

const zoneSchema = z.object({
  name: z.string().min(1).max(60),
  emirates: z.array(z.string().min(2).max(30)).min(1),
  fee: z.coerce.number().min(0).max(10000),
  codFee: z.coerce.number().min(0).max(10000).default(0),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
});

shippingRouter.post('/zones', requirePermission('shipping.manage'), validateBody(zoneSchema), async (req, res) => {
  const zone = await prisma.shippingZone.create({ data: req.body });
  await audit({ adminId: res.locals.admin.id, adminName: res.locals.admin.name, action: 'SHIPPING_ZONE_CREATED', entityType: 'ShippingZone', entityId: String(zone.id), details: { name: zone.name }, ip: clientIp(req) });
  res.status(201).json({ success: true, data: zone });
});

shippingRouter.patch('/zones/:id', requirePermission('shipping.manage'), validateBody(zoneSchema.partial()), async (req, res) => {
  await prisma.shippingZone.update({ where: { id: Number(req.params.id) }, data: req.body });
  res.json({ success: true, data: { message: 'Zone updated' } });
});

shippingRouter.delete('/zones/:id', requirePermission('shipping.manage'), async (req, res) => {
  await prisma.shippingZone.delete({ where: { id: Number(req.params.id) } });
  res.json({ success: true, data: { message: 'Zone deleted' } });
});

const ruleSchema = z.object({
  name: z.string().min(2).max(80),
  ruleType: z.enum(['FREE_SHIPPING_THRESHOLD', 'MIN_ORDER_AMOUNT', 'DELIVERY_ESTIMATE_DAYS']),
  value: z.coerce.number().min(0).max(100000),
  isActive: z.boolean().default(true),
});

shippingRouter.post('/rules', requirePermission('shipping.manage'), validateBody(ruleSchema), async (req, res) => {
  const rule = await prisma.shippingRule.create({ data: req.body });
  await audit({ adminId: res.locals.admin.id, adminName: res.locals.admin.name, action: 'SHIPPING_RULE_CREATED', entityType: 'ShippingRule', entityId: String(rule.id), ip: clientIp(req) });
  res.status(201).json({ success: true, data: rule });
});

shippingRouter.patch('/rules/:id', requirePermission('shipping.manage'), validateBody(ruleSchema.partial()), async (req, res) => {
  await prisma.shippingRule.update({ where: { id: Number(req.params.id) }, data: req.body });
  res.json({ success: true, data: { message: 'Rule updated' } });
});

shippingRouter.delete('/rules/:id', requirePermission('shipping.manage'), async (req, res) => {
  await prisma.shippingRule.delete({ where: { id: Number(req.params.id) } });
  res.json({ success: true, data: { message: 'Rule deleted' } });
});
