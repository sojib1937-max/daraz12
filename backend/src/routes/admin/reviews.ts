// Admin review moderation.
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../lib/errors';
import { requirePermission } from '../../middleware/adminAuth';
import { validateQuery } from '../../middleware/validate';
import { audit } from '../../lib/audit';
import { clientIp } from '../../lib/analytics';

export const reviewsRouter = Router();

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['ALL', 'PENDING', 'APPROVED', 'REJECTED']).default('ALL'),
  q: z.string().max(100).optional(),
});

reviewsRouter.get('/', requirePermission('reviews.manage'), validateQuery(listSchema), async (req, res) => {
  const q = (req as unknown as { validatedQuery: z.infer<typeof listSchema> }).validatedQuery;
  const where: Record<string, unknown> = {};
  if (q.status === 'PENDING') where.isApproved = false;
  if (q.status === 'APPROVED') where.isApproved = true;
  if (q.status === 'REJECTED') where.isApproved = false;
  if (q.q) where.content = { contains: q.q, mode: 'insensitive' };
  const [total, items] = await Promise.all([
    prisma.review.count({ where }),
    prisma.review.findMany({
      where,
      include: { product: { select: { id: true, title: true, slug: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    }),
  ]);
  res.json({
    success: true,
    data: {
      items: items.map((r) => ({
        id: r.id, rating: r.rating, title: r.title, content: r.content, displayName: r.displayName,
        isApproved: r.isApproved, isFeatured: r.isFeatured, isVerifiedPurchase: r.isVerifiedPurchase, isDemo: r.isDemo,
        imageUrl: r.imageUrl, product: r.product, createdAt: r.createdAt.toISOString(),
      })),
      pagination: { page: q.page, limit: q.limit, total, pages: Math.max(1, Math.ceil(total / q.limit)) },
    },
  });
});

reviewsRouter.patch('/:id', requirePermission('reviews.manage'), async (req, res) => {
  const id = Number(req.params.id);
  const { isApproved, isFeatured } = z.object({ isApproved: z.boolean().optional(), isFeatured: z.boolean().optional() }).parse(req.body);
  const review = await prisma.review.findUnique({ where: { id } });
  if (!review) throw AppError.notFound('Review not found');
  const updated = await prisma.review.update({
    where: { id },
    data: {
      ...(isApproved !== undefined ? { isApproved } : {}),
      ...(isFeatured !== undefined ? { isFeatured } : {}),
    },
  });
  // Recompute product rating from approved reviews only.
  await recomputeRating(review.productId);
  await audit({ adminId: res.locals.admin.id, adminName: res.locals.admin.name, action: 'REVIEW_MODERATED', entityType: 'Review', entityId: String(id), details: { isApproved: updated.isApproved, isFeatured: updated.isFeatured }, ip: clientIp(req) });
  res.json({ success: true, data: { message: 'Review updated' } });
});

reviewsRouter.delete('/:id', requirePermission('reviews.manage'), async (req, res) => {
  const id = Number(req.params.id);
  const review = await prisma.review.findUnique({ where: { id } });
  if (!review) throw AppError.notFound('Review not found');
  await prisma.review.delete({ where: { id } });
  await recomputeRating(review.productId);
  await audit({ adminId: res.locals.admin.id, adminName: res.locals.admin.name, action: 'REVIEW_DELETED', entityType: 'Review', entityId: String(id), ip: clientIp(req) });
  res.json({ success: true, data: { message: 'Review deleted' } });
});

export async function recomputeRating(productId: number) {
  const agg = await prisma.review.aggregate({
    where: { productId, isApproved: true },
    _avg: { rating: true },
    _count: true,
  });
  await prisma.product.update({
    where: { id: productId },
    data: { ratingAvg: Math.round((agg._avg.rating || 0) * 100) / 100, ratingCount: agg._count },
  });
}
