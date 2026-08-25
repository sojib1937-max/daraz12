// Admin product management: CRUD, duplicate, bulk actions, import/export,
// stock management. Images/variants/specs handled here.
import { Router } from 'express';
import { z } from 'zod';
import { Prisma, ProductStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../lib/errors';
import { requirePermission } from '../../middleware/adminAuth';
import { validateBody, validateQuery } from '../../middleware/validate';
import { serializeProduct } from '../../lib/serializers';
import { audit } from '../../lib/audit';
import { slugify } from '../../lib/helpers';
import { parseCsv, csvDownload } from '../../lib/csv';
import { clientIp } from '../../lib/analytics';

export const productsRouter = Router();

const productInclude = {
  images: { orderBy: { sortOrder: 'asc' } },
  variants: true,
  category: { select: { id: true, name: true, slug: true, nameAr: true } },
  brand: { select: { id: true, name: true, slug: true } },
  flashSaleItems: { include: { flashSale: true } },
} as const;

const productSchema = z.object({
  title: z.string().min(2, 'Title is required').max(200),
  titleAr: z.string().max(200).optional().or(z.literal('')),
  description: z.string().max(10000).optional().or(z.literal('')),
  descriptionAr: z.string().max(10000).optional().or(z.literal('')),
  price: z.coerce.number().positive('Price must be positive').max(1_000_000),
  compareAtPrice: z.coerce.number().positive().max(1_000_000).optional().nullable(),
  costPrice: z.coerce.number().positive().max(1_000_000).optional().nullable(),
  discountPercent: z.coerce.number().int().min(0).max(99).optional().nullable(),
  sku: z.string().min(2).max(50),
  slug: z.string().max(100).optional().or(z.literal('')),
  stock: z.coerce.number().int().min(0).max(1_000_000).default(0),
  lowStockThreshold: z.coerce.number().int().min(0).max(10000).default(5),
  categoryId: z.coerce.number().int().positive().optional().nullable(),
  brandId: z.coerce.number().int().positive().optional().nullable(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('DRAFT'),
  isFeatured: z.boolean().optional(),
  isBestSeller: z.boolean().optional(),
  isRecommended: z.boolean().optional(),
  weightKg: z.coerce.number().min(0).max(1000).optional().nullable(),
  dimensions: z.string().max(60).optional().or(z.literal('')),
  shippingNote: z.string().max(500).optional().or(z.literal('')),
  shippingNoteAr: z.string().max(500).optional().or(z.literal('')),
  specifications: z.array(z.object({ label: z.string().max(100), value: z.string().max(300) })).max(40).optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  seoTitle: z.string().max(200).optional().or(z.literal('')),
  seoDescription: z.string().max(400).optional().or(z.literal('')),
  videoUrl: z.string().url().optional().or(z.literal('')),
  images: z.array(z.object({ url: z.string().max(500), alt: z.string().max(200).optional(), altAr: z.string().max(200).optional(), isThumbnail: z.boolean().optional() })).max(12).optional(),
  variants: z.array(z.object({
    id: z.number().int().optional(),
    name: z.string().min(1).max(80),
    sku: z.string().min(1).max(50),
    size: z.string().max(30).optional().or(z.literal('')),
    color: z.string().max(30).optional().or(z.literal('')),
    priceDelta: z.coerce.number().min(-100000).max(100000).default(0),
    stock: z.coerce.number().int().min(0).max(1_000_000).default(0),
    imageUrl: z.string().max(500).optional().or(z.literal('')),
  })).max(30).optional(),
  removeImageIds: z.array(z.number().int()).optional(),
  removeVariantIds: z.array(z.number().int()).optional(),
});

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().max(100).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED', 'ALL']).default('ALL'),
  categoryId: z.coerce.number().int().optional(),
  brandId: z.coerce.number().int().optional(),
  stock: z.enum(['all', 'low', 'out']).default('all'),
  sort: z.enum(['newest', 'oldest', 'price_asc', 'price_desc', 'stock_asc', 'sold_desc']).default('newest'),
});

productsRouter.get('/', requirePermission('products.view'), validateQuery(listSchema), async (req, res) => {
  const q = (req as unknown as { validatedQuery: z.infer<typeof listSchema> }).validatedQuery;
  const where: Prisma.ProductWhereInput = { deletedAt: null };
  if (q.q) {
    where.OR = [
      { title: { contains: q.q, mode: 'insensitive' } },
      { titleAr: { contains: q.q, mode: 'insensitive' } },
      { sku: { contains: q.q, mode: 'insensitive' } },
      { slug: { contains: q.q, mode: 'insensitive' } },
    ];
  }
  if (q.status !== 'ALL') where.status = q.status;
  if (q.categoryId) where.categoryId = q.categoryId;
  if (q.brandId) where.brandId = q.brandId;
  if (q.stock === 'low') where.stock = { lte: prisma.product.fields.lowStockThreshold, gt: 0 };
  if (q.stock === 'out') where.stock = 0;

  const orderBy: Prisma.ProductOrderByWithRelationInput[] =
    q.sort === 'oldest' ? [{ createdAt: 'asc' }]
    : q.sort === 'price_asc' ? [{ price: 'asc' }]
    : q.sort === 'price_desc' ? [{ price: 'desc' }]
    : q.sort === 'stock_asc' ? [{ stock: 'asc' }]
    : q.sort === 'sold_desc' ? [{ soldCount: 'desc' }]
    : [{ createdAt: 'desc' }];

  const [total, items] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      include: { images: { take: 1, orderBy: { sortOrder: 'asc' } }, category: true, brand: true, _count: { select: { orderItems: true, variants: true } } },
      orderBy,
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    }),
  ]);

  res.json({
    success: true,
    data: {
      items: items.map((p) => ({
        id: p.id,
        title: p.title,
        titleAr: p.titleAr,
        sku: p.sku,
        slug: p.slug,
        price: Number(p.price),
        compareAtPrice: p.compareAtPrice ? Number(p.compareAtPrice) : null,
        stock: p.stock,
        lowStockThreshold: p.lowStockThreshold,
        status: p.status,
        isFeatured: p.isFeatured,
        isBestSeller: p.isBestSeller,
        isRecommended: p.isRecommended,
        soldCount: p.soldCount,
        thumbnail: p.images[0]?.url ?? '',
        category: p.category ? { id: p.category.id, name: p.category.name } : null,
        brand: p.brand ? { id: p.brand.id, name: p.brand.name } : null,
        orderCount: p._count.orderItems,
        variantCount: p._count.variants,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      })),
      pagination: { page: q.page, limit: q.limit, total, pages: Math.max(1, Math.ceil(total / q.limit)) },
    },
  });
});

productsRouter.get('/export', requirePermission('products.import'), async (_req, res) => {
  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    include: { category: true, brand: true, images: { orderBy: { sortOrder: 'asc' } } },
  });
  csvDownload(
    res,
    `products-${new Date().toISOString().slice(0, 10)}.csv`,
    products.map((p) => ({
      sku: p.sku,
      title: p.title,
      title_ar: p.titleAr || '',
      description: p.description || '',
      price: Number(p.price),
      compare_at_price: p.compareAtPrice ? Number(p.compareAtPrice) : '',
      cost_price: p.costPrice ? Number(p.costPrice) : '',
      stock: p.stock,
      category: p.category?.name || '',
      brand: p.brand?.name || '',
      status: p.status,
      featured: p.isFeatured ? '1' : '0',
      best_seller: p.isBestSeller ? '1' : '0',
      recommended: p.isRecommended ? '1' : '0',
      tags: p.tags.join('|'),
      image_urls: p.images.map((i) => i.url).join('|'),
    }))
  );
});

productsRouter.get('/import-template', requirePermission('products.import'), (_req, res) => {
  csvDownload(res, 'product-import-template.csv', [
    {
      sku: 'SKU-001', title: 'Example Product', title_ar: 'منتج تجريبي', description: 'Short description',
      price: 99, compare_at_price: 149, cost_price: 40, stock: 50, category: 'Electronics', brand: 'NovaTech',
      status: 'PUBLISHED', featured: '1', best_seller: '0', recommended: '1', tags: 'gadget|new', image_urls: 'https://example.com/img1.jpg',
    },
  ]);
});

productsRouter.post('/import', requirePermission('products.import'), async (req, res) => {
  if (!req.body || !req.body.csv) throw AppError.badRequest('Send the CSV content in the "csv" field');
  const rows = parseCsv(Buffer.from(req.body.csv));
  const results = { created: 0, updated: 0, errors: [] as string[] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const title = row.title?.trim();
      if (!title || !row.price || !row.sku) {
        results.errors.push(`Row ${i + 2}: title, price and sku are required`);
        continue;
      }
      const sku = row.sku.trim();
      const category = row.category?.trim()
        ? await prisma.category.findFirst({ where: { name: { equals: row.category.trim(), mode: 'insensitive' } } })
        : null;
      const brand = row.brand?.trim()
        ? await prisma.brand.findFirst({ where: { name: { equals: row.brand.trim(), mode: 'insensitive' } } })
        : null;
      const price = Number(row.price);
      if (!Number.isFinite(price) || price <= 0) {
        results.errors.push(`Row ${i + 2}: invalid price`);
        continue;
      }
      const imageUrls = (row.image_urls || '').split('|').map((s) => s.trim()).filter(Boolean).slice(0, 8);
      const data = {
        title,
        titleAr: row.title_ar || null,
        description: row.description || null,
        sku,
        slug: slugify(row.slug || title) + (await uniqueSlugSuffix(slugify(row.slug || title))),
        price,
        compareAtPrice: row.compare_at_price ? Number(row.compare_at_price) : null,
        costPrice: row.cost_price ? Number(row.cost_price) : null,
        stock: Number(row.stock) || 0,
        categoryId: category?.id ?? null,
        brandId: brand?.id ?? null,
        status: (row.status || 'DRAFT').toUpperCase() as ProductStatus,
        isFeatured: row.featured === '1',
        isBestSeller: row.best_seller === '1',
        isRecommended: row.recommended === '1',
        tags: (row.tags || '').split('|').filter(Boolean),
      };
      const existing = await prisma.product.findUnique({ where: { sku } });
      if (existing) {
        await prisma.product.update({ where: { id: existing.id }, data });
        results.updated++;
      } else {
        await prisma.product.create({
          data: {
            ...data,
            images: imageUrls.length
              ? { create: imageUrls.map((url, idx) => ({ url, sortOrder: idx, isThumbnail: idx === 0 })) }
              : undefined,
          },
        });
        results.created++;
      }
    } catch (err) {
      results.errors.push(`Row ${i + 2}: ${(err as Error).message}`);
    }
  }
  res.json({ success: true, data: results });
});

async function uniqueSlugSuffix(base: string): Promise<string> {
  if (!base) return String(Date.now());
  const exists = await prisma.product.findFirst({ where: { slug: base } });
  return exists ? `${base}-${Date.now().toString(36).slice(-4)}` : base;
}

productsRouter.get('/:id', requirePermission('products.view'), async (req, res) => {
  const product = await prisma.product.findUnique({
    where: { id: Number(req.params.id) },
    include: productInclude,
  });
  if (!product || product.deletedAt) throw AppError.notFound('Product not found');
  const dto = serializeProduct(product, 'en');
  res.json({
    success: true,
    data: {
      product: {
        ...dto,
        // costPrice is admin-only — never exposed through public API
        costPrice: product.costPrice ? Number(product.costPrice) : null,
      },
    },
  });
});

productsRouter.post('/', requirePermission('products.create'), validateBody(productSchema), async (req, res) => {
  const data = req.body;
  const slug = data.slug?.trim() ? slugify(data.slug) : slugify(data.title);
  const finalSlug = (await uniqueSlugSuffix(slug)) || `product-${Date.now()}`;

  const product = await prisma.product.create({
    data: {
      title: data.title.trim(),
      titleAr: data.titleAr?.trim() || null,
      description: data.description || null,
      descriptionAr: data.descriptionAr || null,
      price: data.price,
      compareAtPrice: data.compareAtPrice ?? null,
      costPrice: data.costPrice ?? null,
      discountPercent: data.discountPercent ?? null,
      sku: data.sku.trim(),
      slug: finalSlug,
      stock: data.stock,
      lowStockThreshold: data.lowStockThreshold,
      categoryId: data.categoryId ?? null,
      brandId: data.brandId ?? null,
      status: data.status,
      isFeatured: data.isFeatured ?? false,
      isBestSeller: data.isBestSeller ?? false,
      isRecommended: data.isRecommended ?? false,
      weightKg: data.weightKg ?? null,
      dimensions: data.dimensions || null,
      shippingNote: data.shippingNote || null,
      shippingNoteAr: data.shippingNoteAr || null,
      specifications: data.specifications?.length ? (data.specifications as never) : Prisma.DbNull,
      tags: data.tags || [],
      seoTitle: data.seoTitle || null,
      seoDescription: data.seoDescription || null,
      videoUrl: data.videoUrl || null,
      images: data.images?.length
        ? { create: data.images.map((img: { url: string; alt?: string; altAr?: string; isThumbnail?: boolean }, idx: number) => ({ url: img.url, alt: img.alt, altAr: img.altAr, sortOrder: idx, isThumbnail: img.isThumbnail ?? idx === 0 })) }
        : undefined,
      variants: data.variants?.length
        ? { create: data.variants.map((v: { name: string; sku: string; size?: string; color?: string; priceDelta: number; stock: number; imageUrl?: string }) => ({ name: v.name, sku: v.sku, size: v.size || null, color: v.color || null, priceDelta: v.priceDelta, stock: v.stock, imageUrl: v.imageUrl || null })) }
        : undefined,
    },
  });

  await audit({ adminId: res.locals.admin.id, adminName: res.locals.admin.name, action: 'PRODUCT_CREATED', entityType: 'Product', entityId: String(product.id), details: { sku: product.sku, title: product.title }, ip: clientIp(req) });
  res.status(201).json({ success: true, data: { id: product.id, slug: product.slug } });
});

productsRouter.patch('/:id', requirePermission('products.update'), validateBody(productSchema.partial()), async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) throw AppError.notFound('Product not found');
  const data = req.body;

  const updateData: Prisma.ProductUncheckedUpdateInput = {};
  for (const field of ['title', 'titleAr', 'description', 'descriptionAr', 'price', 'compareAtPrice', 'costPrice', 'discountPercent', 'stock', 'lowStockThreshold', 'categoryId', 'brandId', 'status', 'isFeatured', 'isBestSeller', 'isRecommended', 'weightKg', 'dimensions', 'shippingNote', 'shippingNoteAr', 'seoTitle', 'seoDescription', 'videoUrl'] as const) {
    if (data[field] !== undefined) updateData[field] = data[field] as never;
  }
  if (data.sku !== undefined) updateData.sku = data.sku.trim();
  if (data.slug !== undefined) updateData.slug = slugify(data.slug || existing.title);
  if (data.specifications !== undefined) updateData.specifications = data.specifications?.length ? (data.specifications as never) : Prisma.DbNull;
  if (data.tags !== undefined) updateData.tags = data.tags;

  // Replace images
  if (data.images !== undefined) {
    updateData.images = {
      deleteMany: { productId: id },
      create: data.images.map((img: { url: string; alt?: string; altAr?: string; isThumbnail?: boolean }, idx: number) => ({
        url: img.url, alt: img.alt, altAr: img.altAr, sortOrder: idx, isThumbnail: img.isThumbnail ?? idx === 0,
      })),
    };
  }
  if (data.removeImageIds?.length) {
    await prisma.productImage.deleteMany({ where: { id: { in: data.removeImageIds }, productId: id } });
  }

  // Replace variants (with remove support)
  if (data.removeVariantIds?.length) {
    await prisma.productVariant.deleteMany({ where: { id: { in: data.removeVariantIds }, productId: id } });
  }
  if (data.variants !== undefined) {
    const existingVariants = await prisma.productVariant.findMany({ where: { productId: id } });
    const incomingIds = data.variants.map((v: { id?: number }) => v.id).filter(Boolean);
    for (const ev of existingVariants) {
      if (!incomingIds.includes(ev.id)) {
        await prisma.productVariant.delete({ where: { id: ev.id } });
      }
    }
    for (const v of data.variants) {
      if (v.id) {
        await prisma.productVariant.update({
          where: { id: v.id },
          data: { name: v.name, sku: v.sku, size: v.size || null, color: v.color || null, priceDelta: v.priceDelta, stock: v.stock, imageUrl: v.imageUrl || null },
        });
      } else {
        await prisma.productVariant.create({
          data: { productId: id, name: v.name, sku: v.sku, size: v.size || null, color: v.color || null, priceDelta: v.priceDelta, stock: v.stock, imageUrl: v.imageUrl || null },
        });
      }
    }
  }

  const updated = await prisma.product.update({ where: { id }, data: updateData });
  await audit({ adminId: res.locals.admin.id, adminName: res.locals.admin.name, action: 'PRODUCT_UPDATED', entityType: 'Product', entityId: String(id), details: { title: updated.title }, ip: clientIp(req) });
  res.json({ success: true, data: { id: updated.id } });
});

productsRouter.delete('/:id', requirePermission('products.delete'), async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) throw AppError.notFound('Product not found');
  await prisma.product.update({ where: { id }, data: { deletedAt: new Date(), status: 'ARCHIVED' } });
  await audit({ adminId: res.locals.admin.id, adminName: res.locals.admin.name, action: 'PRODUCT_DELETED', entityType: 'Product', entityId: String(id), details: { title: existing.title }, ip: clientIp(req) });
  res.json({ success: true, data: { message: 'Product deleted' } });
});

productsRouter.post('/:id/duplicate', requirePermission('products.create'), async (req, res) => {
  const id = Number(req.params.id);
  const source = await prisma.product.findUnique({ where: { id }, include: { images: true, variants: true } });
  if (!source || source.deletedAt) throw AppError.notFound('Product not found');
  const newSlug = `${source.slug}-copy-${Date.now().toString(36).slice(-4)}`;
  const copy = await prisma.product.create({
    data: {
      title: `${source.title} (Copy)`,
      titleAr: source.titleAr,
      description: source.description,
      descriptionAr: source.descriptionAr,
      price: source.price,
      compareAtPrice: source.compareAtPrice,
      costPrice: source.costPrice,
      discountPercent: source.discountPercent,
      sku: `${source.sku}-COPY`,
      slug: newSlug,
      stock: source.stock,
      lowStockThreshold: source.lowStockThreshold,
      categoryId: source.categoryId,
      brandId: source.brandId,
      status: 'DRAFT',
      isFeatured: false,
      isBestSeller: false,
      isRecommended: false,
      weightKg: source.weightKg,
      dimensions: source.dimensions,
      shippingNote: source.shippingNote,
      shippingNoteAr: source.shippingNoteAr,
      specifications: source.specifications as never,
      tags: source.tags,
      seoTitle: source.seoTitle,
      seoDescription: source.seoDescription,
      images: source.images.length ? { create: source.images.map((i) => ({ url: i.url, alt: i.alt, altAr: i.altAr, sortOrder: i.sortOrder, isThumbnail: i.isThumbnail })) } : undefined,
      variants: source.variants.length ? { create: source.variants.map((v) => ({ name: v.name, sku: `${v.sku}-C`, size: v.size, color: v.color, priceDelta: v.priceDelta, stock: v.stock, imageUrl: v.imageUrl })) } : undefined,
    },
  });
  await audit({ adminId: res.locals.admin.id, adminName: res.locals.admin.name, action: 'PRODUCT_DUPLICATED', entityType: 'Product', entityId: String(copy.id), details: { from: source.id }, ip: clientIp(req) });
  res.status(201).json({ success: true, data: { id: copy.id } });
});

// Bulk actions: publish/unpublish/delete
productsRouter.post('/bulk', requirePermission('products.update'), async (req, res) => {
  const { ids, action } = z.object({
    ids: z.array(z.number().int().positive()).min(1).max(500),
    action: z.enum(['PUBLISH', 'UNPUBLISH', 'DELETE']),
  }).parse(req.body);

  if (action === 'DELETE') {
    if (!res.locals.admin || !['SUPER_ADMIN', 'ADMIN'].includes(res.locals.admin.role)) {
      throw AppError.forbidden('Only admins can bulk-delete products');
    }
    await prisma.product.updateMany({ where: { id: { in: ids } }, data: { deletedAt: new Date(), status: 'ARCHIVED' } });
  } else {
    await prisma.product.updateMany({
      where: { id: { in: ids } },
      data: { status: action === 'PUBLISH' ? 'PUBLISHED' : 'DRAFT' },
    });
  }
  await audit({ adminId: res.locals.admin.id, adminName: res.locals.admin.name, action: `PRODUCT_BULK_${action}`, entityType: 'Product', details: { ids }, ip: clientIp(req) });
  res.json({ success: true, data: { updated: ids.length } });
});

// Stock adjustment
productsRouter.patch('/:id/stock', requirePermission('products.update'), validateBody(z.object({ stock: z.coerce.number().int().min(0).max(1_000_000) })), async (req, res) => {
  const id = Number(req.params.id);
  await prisma.product.update({ where: { id }, data: { stock: req.body.stock } });
  res.json({ success: true, data: { message: 'Stock updated' } });
});
