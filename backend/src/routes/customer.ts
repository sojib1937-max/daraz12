// Customer account API: my orders, wishlist, profile, addresses, cart sync, reviews.
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { requireCustomer, loadCustomer } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { serializeOrder, serializeProduct } from '../lib/serializers';
import { normalizeUaePhone } from '../lib/helpers';
import { recordEvent, clientIp } from '../lib/analytics';

export const customerRouter = Router();
customerRouter.use(loadCustomer);

const productInclude = {
  images: true,
  variants: true,
  category: { select: { id: true, name: true, slug: true, nameAr: true } },
  brand: { select: { id: true, name: true, slug: true } },
  flashSaleItems: { include: { flashSale: true } },
} as const;

// ---------------- My orders ----------------
customerRouter.get('/orders/my', requireCustomer, async (req, res) => {
  const customer = res.locals.customer;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 10));
  const [total, orders] = await Promise.all([
    prisma.order.count({ where: { customerId: customer.id } }),
    prisma.order.findMany({
      where: { customerId: customer.id },
      include: { items: true, statusHistory: { orderBy: { createdAt: 'desc' }, take: 5 } },
      orderBy: { placedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);
  res.json({
    success: true,
    data: {
      items: orders.map((o) => serializeOrder({ ...o, customer: null })),
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    },
  });
});

customerRouter.get('/orders/my/:orderNumber', requireCustomer, async (req, res) => {
  const customer = res.locals.customer;
  const order = await prisma.order.findFirst({
    where: { orderNumber: String(req.params.orderNumber).toUpperCase(), customerId: customer.id },
    include: { items: true, statusHistory: { orderBy: { createdAt: 'asc' } } },
  });
  if (!order) throw AppError.notFound('Order not found');
  res.json({ success: true, data: { order: serializeOrder({ ...order, customer: null }) } });
});

// ---------------- Reviews (customer submits; admin approves) ----------------
customerRouter.post('/reviews', requireCustomer, validateBody(z.object({
  productId: z.number().int().positive(),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(100).optional().or(z.literal('')),
  content: z.string().min(5).max(1000),
})), async (req, res) => {
  const customer = res.locals.customer;
  const { productId, rating, title, content } = req.body;
  const product = await prisma.product.findFirst({ where: { id: productId, status: 'PUBLISHED', deletedAt: null } });
  if (!product) throw AppError.notFound('Product not found');

  // Only customers who actually ordered can leave a review (verified purchase)
  const purchased = await prisma.orderItem.findFirst({
    where: { productId, order: { customerId: customer.id, status: { notIn: ['CANCELLED', 'RETURNED', 'FAILED_DELIVERY'] } } },
  });

  const recent = await prisma.review.findFirst({
    where: { customerId: customer.id, productId, createdAt: { gte: new Date(Date.now() - 86400000) } },
  });
  if (recent) throw AppError.badRequest('You already reviewed this product. Thank you!');

  const review = await prisma.review.create({
    data: {
      productId,
      customerId: customer.id,
      displayName: customer.name,
      rating,
      title: title || null,
      content,
      isApproved: false,
      isVerifiedPurchase: !!purchased,
    },
  });
  await prisma.notification.create({
    data: {
      type: 'REVIEW',
      title: 'New product review',
      body: `${customer.name} reviewed ${product.title} (${rating}★) — pending approval`,
      data: { reviewId: review.id, productId, productTitle: product.title, rating } as never,
    },
  });
  res.status(201).json({ success: true, data: { message: 'Review submitted for approval' } });
});

// ---------------- Wishlist ----------------
customerRouter.get('/wishlist', requireCustomer, async (req, res) => {
  const customer = res.locals.customer;
  const items = await prisma.wishlistItem.findMany({
    where: { customerId: customer.id },
    include: { product: { include: productInclude } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({
    success: true,
    data: items.map((i) => ({
      id: i.id,
      product: serializeProduct(i.product, (req.query.lang as string) === 'ar' ? 'ar' : 'en'),
    })),
  });
});

customerRouter.post('/wishlist', requireCustomer, validateBody(z.object({ productId: z.number().int().positive() })), async (req, res) => {
  const customer = res.locals.customer;
  const { productId } = req.body;
  const product = await prisma.product.findFirst({ where: { id: productId, status: 'PUBLISHED', deletedAt: null } });
  if (!product) throw AppError.notFound('Product not found');
  await prisma.wishlistItem.upsert({
    where: { customerId_productId: { customerId: customer.id, productId } },
    create: { customerId: customer.id, productId },
    update: {},
  });
  res.json({ success: true, data: { message: 'Added to wishlist' } });
});

customerRouter.delete('/wishlist/:productId', requireCustomer, async (req, res) => {
  const customer = res.locals.customer;
  await prisma.wishlistItem.deleteMany({
    where: { customerId: customer.id, productId: Number(req.params.productId) },
  });
  res.json({ success: true, data: { message: 'Removed from wishlist' } });
});

// ---------------- Profile ----------------
customerRouter.patch('/account/profile', requireCustomer, validateBody(z.object({
  name: z.string().min(2).max(80),
  email: z.string().email().optional().or(z.literal('')),
})), async (req, res) => {
  const customer = res.locals.customer;
  const updated = await prisma.customer.update({
    where: { id: customer.id },
    data: { name: req.body.name.trim(), email: req.body.email?.trim() || null },
  });
  res.json({ success: true, data: { id: updated.id, name: updated.name, phone: updated.phone, email: updated.email } });
});

customerRouter.post('/account/change-password', requireCustomer, validateBody(z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(100),
})), async (req, res) => {
  const customer = res.locals.customer;
  if (!customer.passwordHash) throw AppError.badRequest('This account uses guest checkout and has no password. Register first.');
  const { verifyPassword, hashPassword } = await import('../lib/security');
  const ok = await verifyPassword(req.body.currentPassword, customer.passwordHash);
  if (!ok) throw AppError.badRequest('Current password is incorrect');
  await prisma.customer.update({ where: { id: customer.id }, data: { passwordHash: await hashPassword(req.body.newPassword) } });
  res.json({ success: true, data: { message: 'Password updated' } });
});

// ---------------- Addresses ----------------
customerRouter.get('/account/addresses', requireCustomer, async (req, res) => {
  const customer = res.locals.customer;
  const addresses = await prisma.address.findMany({ where: { customerId: customer.id }, orderBy: { isDefault: 'desc' } });
  res.json({ success: true, data: addresses });
});

const addressSchema = z.object({
  label: z.string().max(40).default('Home'),
  fullName: z.string().min(2).max(80),
  phone: z.string().min(8).max(16),
  emirate: z.string().min(2).max(30),
  area: z.string().min(2).max(100),
  address: z.string().min(5).max(200),
  building: z.string().max(100).optional().or(z.literal('')),
  apartment: z.string().max(50).optional().or(z.literal('')),
  landmark: z.string().max(100).optional().or(z.literal('')),
  isDefault: z.boolean().optional(),
});

customerRouter.post('/account/addresses', requireCustomer, validateBody(addressSchema), async (req, res) => {
  const customer = res.locals.customer;
  const phone = normalizeUaePhone(req.body.phone) || req.body.phone;
  const address = await prisma.address.create({
    data: { customerId: customer.id, ...req.body, phone },
  });
  if (req.body.isDefault) {
    await prisma.address.updateMany({ where: { customerId: customer.id, id: { not: address.id } }, data: { isDefault: false } });
  }
  res.status(201).json({ success: true, data: address });
});

customerRouter.patch('/account/addresses/:id', requireCustomer, validateBody(addressSchema.partial()), async (req, res) => {
  const customer = res.locals.customer;
  const address = await prisma.address.findFirst({ where: { id: Number(req.params.id), customerId: customer.id } });
  if (!address) throw AppError.notFound('Address not found');
  const updated = await prisma.address.update({
    where: { id: address.id },
    data: { ...req.body, phone: req.body.phone ? normalizeUaePhone(req.body.phone) || req.body.phone : undefined },
  });
  if (req.body.isDefault) {
    await prisma.address.updateMany({ where: { customerId: customer.id, id: { not: address.id } }, data: { isDefault: false } });
  }
  res.json({ success: true, data: updated });
});

customerRouter.delete('/account/addresses/:id', requireCustomer, async (req, res) => {
  const customer = res.locals.customer;
  await prisma.address.deleteMany({ where: { id: Number(req.params.id), customerId: customer.id } });
  res.json({ success: true, data: { message: 'Address deleted' } });
});

// ---------------- Cart sync (abandoned-cart tracking + logged-in persistence) ----------------
const cartSyncSchema = z.object({
  guestId: z.string().min(8).max(64).optional(),
  items: z.array(z.object({
    productId: z.number().int().positive(),
    variantId: z.number().int().positive().nullable().optional(),
    quantity: z.number().int().min(1).max(50),
    price: z.number().min(0),
    title: z.string().max(200),
    image: z.string().max(500).optional(),
  })).max(100),
  progress: z.enum(['BROWSING', 'CART', 'CUSTOMER_INFO', 'DELIVERY', 'REVIEW', 'PLACED']).default('CART'),
});

customerRouter.post('/cart/sync', async (req, res) => {
  const parsed = cartSyncSchema.parse(req.body);
  const customer = res.locals.customer;

  let sessionId = parsed.guestId || '';
  if (!sessionId) {
    // derive a stable id from customer
    sessionId = customer ? `cust-${customer.id}` : `anon-${Math.random().toString(36).slice(2, 12)}`;
  }

  await prisma.cartSession.upsert({
    where: { id: sessionId },
    create: {
      id: sessionId,
      guestId: customer ? null : sessionId,
      customerId: customer?.id ?? null,
      items: parsed.items as never,
      progress: parsed.progress,
      ip: clientIp(req),
      userAgent: req.headers['user-agent']?.slice(0, 200),
      expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
    },
    update: {
      customerId: customer?.id ?? undefined,
      items: parsed.items as never,
      progress: parsed.progress,
      expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
    },
  });

  if (parsed.progress === 'CUSTOMER_INFO' || parsed.progress === 'DELIVERY' || parsed.progress === 'REVIEW') {
    recordEvent({ type: 'CHECKOUT_STARTED', sessionId, ip: clientIp(req) });
  }

  res.json({ success: true, data: { sessionId, synced: true } });
});

customerRouter.get('/cart/restore', async (req, res) => {
  const customer = res.locals.customer;
  const guestId = req.query.guestId as string | undefined;
  const where = customer
    ? { OR: [{ customerId: customer.id }, ...(guestId ? [{ guestId }] : [])] }
    : guestId
    ? { guestId }
    : { id: '__never__' };
  const latest = await prisma.cartSession.findFirst({
    where: where as never,
    orderBy: { updatedAt: 'desc' },
    take: 1,
  });
  res.json({
    success: true,
    data: latest ? { items: latest.items, progress: latest.progress, updatedAt: latest.updatedAt } : null,
  });
});

// Analytics events (public, fire-and-forget)
customerRouter.post('/analytics/event', async (req, res) => {
  const { type, productId } = z
    .object({ type: z.enum(['PAGE_VIEW', 'PRODUCT_VIEW', 'ADD_TO_CART', 'CHECKOUT_STARTED', 'SEARCH']), productId: z.number().int().optional() })
    .parse(req.body);
  const visitor = req.cookies?.dc_visitor || `anon-${Math.random().toString(36).slice(2, 10)}`;
  if (!req.cookies?.dc_visitor) {
    res.cookie('dc_visitor', visitor, { httpOnly: false, maxAge: 365 * 24 * 3600 * 1000, sameSite: 'lax', path: '/' });
  }
  await recordEvent({ type, productId, sessionId: visitor, ip: clientIp(req) });
  res.json({ success: true, data: { ok: true } });
});

// Visitor session id for abandoned-cart correlation
customerRouter.get('/visitor', (_req, res) => {
  const visitor = `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  res.cookie('dc_visitor', visitor, { httpOnly: false, maxAge: 365 * 24 * 3600 * 1000, sameSite: 'lax', path: '/' });
  res.json({ success: true, data: { visitorId: visitor } });
});
