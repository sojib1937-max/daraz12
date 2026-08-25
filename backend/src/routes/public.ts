// Public storefront API: home, products, categories, search, tracking,
// reviews, coupons, contact, newsletter, settings.
import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { validateQuery } from '../middleware/validate';
import { serializeProduct, serializeOrder } from '../lib/serializers';
import { getPublicSettings } from '../lib/settings';
import { emirateName, normalizeUaePhone } from '../lib/helpers';
import { recordEvent, clientIp } from '../lib/analytics';
import { formLimiter } from '../lib/rateLimit';
import { loadCustomer } from '../middleware/auth';

export const publicRouter = Router();

publicRouter.use(loadCustomer);

const langOf = (req: { query: Record<string, unknown> }): 'en' | 'ar' => (req.query.lang === 'ar' ? 'ar' : 'en');

const productInclude = {
  images: true,
  variants: true,
  category: { select: { id: true, name: true, slug: true, nameAr: true } },
  brand: { select: { id: true, name: true, slug: true } },
  flashSaleItems: { include: { flashSale: true } },
} as const;

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(12),
  q: z.string().max(100).optional(),
  category: z.string().max(100).optional(),
  brand: z.string().max(100).optional(),
  min: z.coerce.number().optional(),
  max: z.coerce.number().optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc', 'popular', 'rating']).default('newest'),
  featured: z.enum(['true', 'false']).optional(),
  bestSeller: z.enum(['true', 'false']).optional(),
  recommended: z.enum(['true', 'false']).optional(),
  flash: z.enum(['true', 'false']).optional(),
  tag: z.string().max(50).optional(),
  lang: z.enum(['en', 'ar']).optional(),
});

publicRouter.get('/products', validateQuery(listSchema), async (req, res) => {
  const { page, limit, q, category, brand, min, max, sort, featured, bestSeller, recommended, flash, tag } = (req as unknown as { validatedQuery: z.infer<typeof listSchema> }).validatedQuery;
  const lang = langOf(req);

  const where: Prisma.ProductWhereInput = {
    status: 'PUBLISHED',
    deletedAt: null,
    stock: { gt: 0 },
  };
  if (q) {
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { titleAr: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
      { tags: { has: q } },
      { sku: { contains: q, mode: 'insensitive' } },
    ];
  }
  if (category) {
    const cat = await prisma.category.findFirst({
      where: { slug: category, deletedAt: null },
      include: { children: true },
    });
    if (!cat) throw AppError.notFound('Category not found');
    const childSlugs = cat.children.map((c) => c.slug);
    where.category = { slug: { in: [category, ...childSlugs] } };
  }
  if (brand) where.brand = { slug: brand };
  if (min !== undefined) where.price = { ...(where.price as object), gte: min };
  if (max !== undefined) where.price = { ...(where.price as object), lte: max };
  if (featured === 'true') where.isFeatured = true;
  if (bestSeller === 'true') where.isBestSeller = true;
  if (recommended === 'true') where.isRecommended = true;
  if (tag) where.tags = { has: tag };

  const orderBy: Prisma.ProductOrderByWithRelationInput[] =
    sort === 'price_asc'
      ? [{ price: 'asc' }]
      : sort === 'price_desc'
      ? [{ price: 'desc' }]
      : sort === 'popular'
      ? [{ soldCount: 'desc' }]
      : sort === 'rating'
      ? [{ ratingAvg: 'desc' }]
      : [{ createdAt: 'desc' }];

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      include: productInclude,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  if (q) {
    recordEvent({ type: 'SEARCH', sessionId: req.cookies?.dc_visitor, ip: clientIp(req), meta: { q } });
  }

  res.json({
    success: true,
    data: {
      items: products.map((p) => serializeProduct(p, lang)),
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    },
  });
});

publicRouter.get('/products/:slug', async (req, res) => {
  const lang = langOf(req);
  const product = await prisma.product.findFirst({
    where: { slug: req.params.slug, status: 'PUBLISHED', deletedAt: null },
    include: productInclude,
  });
  if (!product) throw AppError.notFound('Product not found');

  const related = await prisma.product.findMany({
    where: {
      status: 'PUBLISHED',
      deletedAt: null,
      id: { not: product.id },
      OR: [{ categoryId: product.categoryId }, { tags: { hasSome: product.tags.slice(0, 3) } }],
    },
    include: productInclude,
    take: 8,
  });

  recordEvent({ type: 'PRODUCT_VIEW', productId: product.id, sessionId: req.cookies?.dc_visitor, ip: clientIp(req) });

  res.json({ success: true, data: { product: serializeProduct(product, lang), related: related.map((p) => serializeProduct(p, lang)) } });
});

// ---------------- Public settings ----------------
publicRouter.get('/settings/public', async (_req, res) => {
  const settings = await getPublicSettings();
  res.json({ success: true, data: settings });
});

// ---------------- Categories ----------------
publicRouter.get('/categories', async (req, res) => {
  const lang = langOf(req);
  const cats = await prisma.category.findMany({
    where: { isActive: true, deletedAt: null, parentId: null },
    include: { children: { where: { isActive: true, deletedAt: null }, orderBy: { sortOrder: 'asc' } } },
    orderBy: { sortOrder: 'asc' },
  });
  res.json({
    success: true,
    data: cats.map((c) => ({
      id: c.id,
      name: lang === 'ar' && c.nameAr ? c.nameAr : c.name,
      nameEn: c.name,
      nameAr: c.nameAr,
      slug: c.slug,
      description: lang === 'ar' && c.descriptionAr ? c.descriptionAr : c.description,
      imageUrl: c.imageUrl,
      bannerUrl: c.bannerUrl,
      productCount: 0,
      children: c.children.map((ch) => ({
        id: ch.id,
        name: lang === 'ar' && ch.nameAr ? ch.nameAr : ch.name,
        nameEn: ch.name,
        slug: ch.slug,
      })),
    })),
  });
});

publicRouter.get('/categories/:slug', async (req, res) => {
  const lang = langOf(req);
  const cat = await prisma.category.findFirst({
    where: { slug: req.params.slug, isActive: true, deletedAt: null },
    include: { children: { where: { isActive: true, deletedAt: null } }, parent: true },
  });
  if (!cat) throw AppError.notFound('Category not found');
  res.json({
    success: true,
    data: {
      id: cat.id,
      name: lang === 'ar' && cat.nameAr ? cat.nameAr : cat.name,
      nameEn: cat.name,
      nameAr: cat.nameAr,
      slug: cat.slug,
      description: lang === 'ar' && cat.descriptionAr ? cat.descriptionAr : cat.description,
      imageUrl: cat.imageUrl,
      bannerUrl: cat.bannerUrl,
      seoTitle: cat.seoTitle,
      seoDescription: cat.seoDescription,
      parent: cat.parent ? { id: cat.parent.id, name: cat.parent.name, slug: cat.parent.slug } : null,
      children: cat.children.map((ch) => ({ id: ch.id, name: ch.name, nameAr: ch.nameAr, slug: ch.slug })),
    },
  });
});

publicRouter.get('/brands', async (_req, res) => {
  const brands = await prisma.brand.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  res.json({ success: true, data: brands.map((b) => ({ id: b.id, name: b.name, slug: b.slug, logoUrl: b.logoUrl })) });
});

// ---------------- Home (single payload for fast first paint) ----------------
publicRouter.get('/home', async (req, res) => {
  const lang = langOf(req);
  const [settings, sections, featured, bestSellers, recommended, categories, flashSale, reviews] = await Promise.all([
    getPublicSettings(),
    prisma.homepageSection.findMany({ where: { isEnabled: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.product.findMany({ where: { status: 'PUBLISHED', deletedAt: null, isFeatured: true, stock: { gt: 0 } }, include: productInclude, take: 8 }),
    prisma.product.findMany({ where: { status: 'PUBLISHED', deletedAt: null, isBestSeller: true, stock: { gt: 0 } }, include: productInclude, take: 8 }),
    prisma.product.findMany({ where: { status: 'PUBLISHED', deletedAt: null, isRecommended: true, stock: { gt: 0 } }, include: productInclude, take: 8 }),
    prisma.category.findMany({ where: { isActive: true, deletedAt: null }, include: { _count: { select: { products: { where: { status: 'PUBLISHED' } } } } }, orderBy: { sortOrder: 'asc' }, take: 12 }),
    prisma.flashSale.findFirst({
      where: { isActive: true, startsAt: { lte: new Date() }, endsAt: { gt: new Date() } },
      include: { items: { where: { isActive: true }, include: { product: { include: productInclude } }, take: 8 } },
      orderBy: { endsAt: 'asc' },
    }),
    prisma.review.findMany({
      where: { isApproved: true, isFeatured: true },
      include: { product: { select: { id: true, slug: true, title: true, images: { take: 1 } } } },
      take: 6,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const categoriesWithCount = categories.map((c) => ({
    id: c.id,
    name: lang === 'ar' && c.nameAr ? c.nameAr : c.name,
    nameEn: c.name,
    nameAr: c.nameAr,
    slug: c.slug,
    imageUrl: c.imageUrl,
    productCount: c._count.products,
  }));

  res.json({
    success: true,
    data: {
      settings,
      sections: sections.map((s) => ({ id: s.id, type: s.type, title: s.title, titleAr: s.titleAr, subtitle: s.subtitle, subtitleAr: s.subtitleAr, config: s.config, sortOrder: s.sortOrder })),
      featured: featured.map((p) => serializeProduct(p, lang)),
      bestSellers: bestSellers.map((p) => serializeProduct(p, lang)),
      recommended: recommended.map((p) => serializeProduct(p, lang)),
      categories: categoriesWithCount,
      flashSale: flashSale
        ? {
            id: flashSale.id,
            title: lang === 'ar' && flashSale.titleAr ? flashSale.titleAr : flashSale.title,
            titleEn: flashSale.title,
            bannerUrl: flashSale.bannerUrl,
            startsAt: flashSale.startsAt.toISOString(),
            endsAt: flashSale.endsAt.toISOString(),
            items: flashSale.items.map((i) => ({ ...serializeProduct(i.product, lang), flashPrice: Number(i.salePrice), flashSaleEndsAt: flashSale.endsAt.toISOString() })),
          }
        : null,
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        title: r.title,
        content: r.content,
        displayName: r.displayName,
        product: r.product ? { slug: r.product.slug, title: r.product.title, image: r.product.images[0]?.url } : null,
        isDemo: r.isDemo,
        createdAt: r.createdAt.toISOString(),
      })),
    },
  });
});

// ---------------- Coupon validation ----------------
publicRouter.post('/coupons/validate', async (req, res) => {
  const { code, subtotal, productIds, emirate } = z
    .object({ code: z.string().max(50), subtotal: z.number().min(0), productIds: z.array(z.number()).optional(), emirate: z.string().optional() })
    .parse(req.body);

  const coupon = await prisma.coupon.findUnique({
    where: { code: code.trim().toUpperCase() },
    include: { products: true, categories: true },
  });
  if (!coupon || !coupon.isActive) throw AppError.notFound('Invalid coupon code');
  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) throw AppError.badRequest('This coupon is not active yet');
  if (coupon.expiresAt && coupon.expiresAt < now) throw AppError.badRequest('This coupon has expired');
  if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) throw AppError.badRequest('This coupon has reached its usage limit');
  if (coupon.minOrderAmount && subtotal < Number(coupon.minOrderAmount)) {
    throw AppError.badRequest(`This coupon requires a minimum order of AED ${Number(coupon.minOrderAmount).toFixed(2)}`);
  }
  // per-customer limit by phone (we only know phone at checkout — pass it optionally)
  const phone = req.body.phone ? normalizeUaePhone(req.body.phone) : undefined;
  if (phone) {
    const used = await prisma.couponUsage.count({ where: { couponId: coupon.id, phone } });
    if (used >= (coupon.perCustomerLimit || 1)) throw AppError.badRequest('You have already used this coupon');
  }

  let discount = 0;
  if (coupon.type === 'PERCENTAGE') {
    discount = (subtotal * Number(coupon.value)) / 100;
    if (coupon.maxDiscount) discount = Math.min(discount, Number(coupon.maxDiscount));
  } else if (coupon.type === 'FIXED') {
    discount = Math.min(Number(coupon.value), subtotal);
  }

  res.json({
    success: true,
    data: {
      id: coupon.id,
      code: coupon.code,
      type: coupon.type,
      discount: Math.round(discount * 100) / 100,
      description: couponDescription(coupon),
    },
  });
});

function couponDescription(coupon: { type: string; value: unknown; minOrderAmount: unknown }) {
  const v = Number(coupon.value);
  if (coupon.type === 'PERCENTAGE') return `${v}% off`;
  if (coupon.type === 'FIXED') return `AED ${v} off`;
  return 'Free shipping';
}

// ---------------- Order tracking (public, by order number + phone) ----------------
publicRouter.get('/orders/track', async (req, res) => {
  const { orderId, phone } = z.object({ orderId: z.string().min(5).max(40), phone: z.string().min(8).max(16) }).parse(req.query);
  const normalized = normalizeUaePhone(phone);
  const order = await prisma.order.findFirst({
    where: { orderNumber: orderId.trim().toUpperCase(), customerPhone: normalized || phone },
    include: { items: true, statusHistory: { orderBy: { createdAt: 'asc' } } },
  });
  if (!order) throw AppError.notFound('No order found with these details. Check the order ID and mobile number.');

  const TIMELINE = ['NEW', 'CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'];
  const currentIdx = TIMELINE.indexOf(order.status);

  res.json({
    success: true,
    data: {
      orderNumber: order.orderNumber,
      status: order.status,
      emirate: emirateName(order.emirate),
      deliveryEstimate: order.deliveryEstimate,
      placedAt: order.placedAt.toISOString(),
      total: Number(order.total),
      isDemo: order.isDemo,
      items: order.items.map((i) => ({ title: i.productTitle, quantity: i.quantity, unitPrice: Number(i.unitPrice), imageUrl: i.imageUrl })),
      timeline: TIMELINE.map((s, idx) => ({
        status: s,
        reached: idx <= currentIdx,
        reachedAt: order.statusHistory.find((h) => h.status === s)?.createdAt.toISOString() ?? null,
      })),
      history: order.statusHistory.map((h) => ({ status: h.status, note: h.note, createdAt: h.createdAt.toISOString() })),
    },
  });
});

// ---------------- Reviews ----------------
publicRouter.get('/products/:slug/reviews', async (req, res) => {
  const product = await prisma.product.findUnique({ where: { slug: req.params.slug } });
  if (!product) throw AppError.notFound('Product not found');
  const reviews = await prisma.review.findMany({
    where: { productId: product.id, isApproved: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json({
    success: true,
    data: reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      content: r.content,
      displayName: r.displayName,
      imageUrl: r.imageUrl,
      isVerifiedPurchase: r.isVerifiedPurchase,
      isDemo: r.isDemo,
      createdAt: r.createdAt.toISOString(),
    })),
  });
});

// ---------------- Contact / newsletter ----------------
publicRouter.post('/contact', formLimiter, async (req, res) => {
  const data = z
    .object({ name: z.string().min(2).max(80), email: z.string().email(), phone: z.string().min(8).max(16).optional().or(z.literal('')), subject: z.string().max(120).optional().or(z.literal('')), message: z.string().min(5).max(2000) })
    .parse(req.body);
  const { sendEmail } = await import('../lib/notifications');
  const settings = (await getPublicSettings()) as unknown as Record<string, unknown>;
  await sendEmail({
    to: String(settings['store.email'] || 'support@desertcart.ae'),
    subject: `[Contact] ${data.subject || 'New message'} from ${data.name}`,
    text: `Name: ${data.name}\nEmail: ${data.email}\nPhone: ${data.phone || '-'}\n\n${data.message}`,
  });
  res.json({ success: true, data: { message: 'Thank you! Your message has been sent. We will reply within 24 hours.' } });
});

publicRouter.post('/newsletter/subscribe', formLimiter, async (req, res) => {
  const { email } = z.object({ email: z.string().email() }).parse(req.body);
  const normalized = email.toLowerCase().trim();
  await prisma.newsletterSubscriber.upsert({
    where: { email: normalized },
    create: { email: normalized },
    update: { isActive: true },
  });
  res.json({ success: true, data: { message: 'Subscribed! Welcome to the DesertCart newsletter.' } });
});
