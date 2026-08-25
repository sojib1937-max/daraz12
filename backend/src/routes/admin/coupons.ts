// Admin coupon management.
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../lib/errors';
import { requirePermission } from '../../middleware/adminAuth';
import { validateBody } from '../../middleware/validate';
import { audit } from '../../lib/audit';
import { clientIp } from '../../lib/analytics';

export const couponsRouter = Router();

const couponSchema = z.object({
  code: z.string().min(3).max(50).transform((s) => s.trim().toUpperCase()),
  type: z.enum(['PERCENTAGE', 'FIXED', 'FREE_SHIPPING']),
  value: z.coerce.number().min(0).max(100),
  minOrderAmount: z.coerce.number().min(0).optional().nullable(),
  maxDiscount: z.coerce.number().min(0).optional().nullable(),
  startsAt: z.string().datetime().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  usageLimit: z.coerce.number().int().min(1).optional().nullable(),
  perCustomerLimit: z.coerce.number().int().min(1).default(1),
  isActive: z.boolean().default(true),
  productIds: z.array(z.number().int().positive()).max(500).optional(),
  categoryIds: z.array(z.number().int().positive()).max(100).optional(),
});

couponsRouter.get('/', requirePermission('coupons.manage'), async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const q = String(req.query.q || '');
  const where = q ? { code: { contains: q.toUpperCase() } } : {};
  const [total, items] = await Promise.all([
    prisma.coupon.count({ where }),
    prisma.coupon.findMany({
      where,
      include: { _count: { select: { usages: true } }, products: { take: 5, include: { product: { select: { id: true, title: true } } } }, categories: { take: 5, include: { category: { select: { id: true, name: true } } } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);
  res.json({
    success: true,
    data: {
      items: items.map((c) => ({
        id: c.id, code: c.code, type: c.type, value: Number(c.value),
        minOrderAmount: c.minOrderAmount ? Number(c.minOrderAmount) : null,
        maxDiscount: c.maxDiscount ? Number(c.maxDiscount) : null,
        startsAt: c.startsAt?.toISOString() ?? null, expiresAt: c.expiresAt?.toISOString() ?? null,
        usageLimit: c.usageLimit, perCustomerLimit: c.perCustomerLimit,
        usageCount: c.usageCount, isActive: c.isActive, isDemo: c.isDemo,
        products: c.products.map((p) => ({ id: p.product.id, title: p.product.title })),
        categories: c.categories.map((x) => ({ id: x.category.id, name: x.category.name })),
        createdAt: c.createdAt.toISOString(),
      })),
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    },
  });
});

couponsRouter.post('/', requirePermission('coupons.manage'), validateBody(couponSchema), async (req, res) => {
  const data = req.body;
  const exists = await prisma.coupon.findUnique({ where: { code: data.code } });
  if (exists) throw AppError.conflict('A coupon with this code already exists');
  const coupon = await prisma.coupon.create({
    data: {
      code: data.code, type: data.type, value: data.value,
      minOrderAmount: data.minOrderAmount ?? null, maxDiscount: data.maxDiscount ?? null,
      startsAt: data.startsAt ? new Date(data.startsAt) : null, expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      usageLimit: data.usageLimit ?? null, perCustomerLimit: data.perCustomerLimit, isActive: data.isActive,
      products: data.productIds?.length ? { create: data.productIds.map((id: number) => ({ productId: id })) } : undefined,
      categories: data.categoryIds?.length ? { create: data.categoryIds.map((id: number) => ({ categoryId: id })) } : undefined,
    },
  });
  await audit({ adminId: res.locals.admin.id, adminName: res.locals.admin.name, action: 'COUPON_CREATED', entityType: 'Coupon', entityId: String(coupon.id), details: { code: coupon.code }, ip: clientIp(req) });
  res.status(201).json({ success: true, data: coupon });
});

couponsRouter.patch('/:id', requirePermission('coupons.manage'), validateBody(couponSchema.partial()), async (req, res) => {
  const id = Number(req.params.id);
  const data = req.body;
  const coupon = await prisma.coupon.findUnique({ where: { id } });
  if (!coupon) throw AppError.notFound('Coupon not found');
  if (data.code && data.code !== coupon.code) {
    const exists = await prisma.coupon.findUnique({ where: { code: data.code } });
    if (exists) throw AppError.conflict('A coupon with this code already exists');
  }
  const updateData: Record<string, unknown> = {};
  for (const k of ['code', 'type', 'value', 'minOrderAmount', 'maxDiscount', 'usageLimit', 'perCustomerLimit', 'isActive']) {
    if (data[k] !== undefined) updateData[k] = data[k];
  }
  if (data.startsAt !== undefined) updateData.startsAt = data.startsAt ? new Date(data.startsAt) : null;
  if (data.expiresAt !== undefined) updateData.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
  if (data.productIds) {
    await prisma.couponProduct.deleteMany({ where: { couponId: id } });
    updateData.products = { create: data.productIds.map((pid: number) => ({ productId: pid })) };
  }
  if (data.categoryIds) {
    await prisma.couponCategory.deleteMany({ where: { couponId: id } });
    updateData.categories = { create: data.categoryIds.map((cid: number) => ({ categoryId: cid })) };
  }
  await prisma.coupon.update({ where: { id }, data: updateData as never });
  await audit({ adminId: res.locals.admin.id, adminName: res.locals.admin.name, action: 'COUPON_UPDATED', entityType: 'Coupon', entityId: String(id), ip: clientIp(req) });
  res.json({ success: true, data: { message: 'Coupon updated' } });
});

couponsRouter.delete('/:id', requirePermission('coupons.manage'), async (req, res) => {
  const id = Number(req.params.id);
  await prisma.coupon.delete({ where: { id } });
  await audit({ adminId: res.locals.admin.id, adminName: res.locals.admin.name, action: 'COUPON_DELETED', entityType: 'Coupon', entityId: String(id), ip: clientIp(req) });
  res.json({ success: true, data: { message: 'Coupon deleted' } });
});
