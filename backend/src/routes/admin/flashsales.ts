// Admin flash-sale management.
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../lib/errors';
import { requirePermission } from '../../middleware/adminAuth';
import { validateBody } from '../../middleware/validate';
import { audit } from '../../lib/audit';
import { clientIp } from '../../lib/analytics';

export const flashSalesRouter = Router();

const saleSchema = z.object({
  title: z.string().min(2).max(100),
  titleAr: z.string().max(100).optional().or(z.literal('')),
  bannerUrl: z.string().max(500).optional().or(z.literal('')),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  isActive: z.boolean().default(true),
  items: z.array(z.object({
    productId: z.number().int().positive(),
    salePrice: z.coerce.number().positive().max(1_000_000),
    stockLimit: z.coerce.number().int().min(0).optional().nullable(),
  })).min(1).max(50),
});

flashSalesRouter.get('/', requirePermission('flashsales.manage'), async (_req, res) => {
  const sales = await prisma.flashSale.findMany({
    include: {
      items: { include: { product: { select: { id: true, title: true, price: true, images: { take: 1 } } } } },
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json({
    success: true,
    data: sales.map((s) => ({
      id: s.id, title: s.title, titleAr: s.titleAr, bannerUrl: s.bannerUrl,
      startsAt: s.startsAt.toISOString(), endsAt: s.endsAt.toISOString(),
      isActive: s.isActive, isDemo: s.isDemo, isRunning: s.isActive && s.startsAt <= new Date() && s.endsAt > new Date(),
      itemCount: s._count.items,
      items: s.items.map((i) => ({ productId: i.productId, salePrice: Number(i.salePrice), stockLimit: i.stockLimit, soldCount: i.soldCount, product: i.product })),
    })),
  });
});

flashSalesRouter.post('/', requirePermission('flashsales.manage'), validateBody(saleSchema), async (req, res) => {
  const data = req.body;
  if (new Date(data.endsAt) <= new Date(data.startsAt)) {
    throw AppError.badRequest('End time must be after start time');
  }
  const sale = await prisma.flashSale.create({
    data: {
      title: data.title, titleAr: data.titleAr || null, bannerUrl: data.bannerUrl || null,
      startsAt: new Date(data.startsAt), endsAt: new Date(data.endsAt), isActive: data.isActive,
      items: { create: data.items.map((i: { productId: number; salePrice: number; stockLimit?: number | null }) => ({ productId: i.productId, salePrice: i.salePrice, stockLimit: i.stockLimit ?? null })) },
    },
  });
  await audit({ adminId: res.locals.admin.id, adminName: res.locals.admin.name, action: 'FLASH_SALE_CREATED', entityType: 'FlashSale', entityId: String(sale.id), details: { title: sale.title }, ip: clientIp(req) });
  res.status(201).json({ success: true, data: sale });
});

flashSalesRouter.patch('/:id', requirePermission('flashsales.manage'), validateBody(saleSchema.partial()), async (req, res) => {
  const id = Number(req.params.id);
  const data = req.body;
  const sale = await prisma.flashSale.findUnique({ where: { id } });
  if (!sale) throw AppError.notFound('Flash sale not found');
  const updateData: Record<string, unknown> = {};
  for (const k of ['title', 'titleAr', 'bannerUrl', 'isActive']) {
    if (data[k] !== undefined) updateData[k] = data[k];
  }
  if (data.startsAt !== undefined) updateData.startsAt = new Date(data.startsAt);
  if (data.endsAt !== undefined) updateData.endsAt = new Date(data.endsAt);
  if (data.items) {
    await prisma.flashSaleItem.deleteMany({ where: { flashSaleId: id } });
    updateData.items = { create: data.items.map((i: { productId: number; salePrice: number; stockLimit?: number | null }) => ({ productId: i.productId, salePrice: i.salePrice, stockLimit: i.stockLimit ?? null })) };
  }
  await prisma.flashSale.update({ where: { id }, data: updateData as never });
  await audit({ adminId: res.locals.admin.id, adminName: res.locals.admin.name, action: 'FLASH_SALE_UPDATED', entityType: 'FlashSale', entityId: String(id), ip: clientIp(req) });
  res.json({ success: true, data: { message: 'Flash sale updated' } });
});

flashSalesRouter.delete('/:id', requirePermission('flashsales.manage'), async (req, res) => {
  await prisma.flashSale.delete({ where: { id: Number(req.params.id) } });
  res.json({ success: true, data: { message: 'Flash sale deleted' } });
});
