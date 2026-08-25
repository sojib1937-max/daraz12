// Admin category + brand management.
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../lib/errors';
import { requirePermission } from '../../middleware/adminAuth';
import { validateBody } from '../../middleware/validate';
import { audit } from '../../lib/audit';
import { slugify } from '../../lib/helpers';
import { clientIp } from '../../lib/analytics';

export const categoriesRouter = Router();

const categorySchema = z.object({
  name: z.string().min(2).max(100),
  nameAr: z.string().max(100).optional().or(z.literal('')),
  slug: z.string().max(100).optional().or(z.literal('')),
  description: z.string().max(2000).optional().or(z.literal('')),
  descriptionAr: z.string().max(2000).optional().or(z.literal('')),
  imageUrl: z.string().max(500).optional().or(z.literal('')),
  bannerUrl: z.string().max(500).optional().or(z.literal('')),
  parentId: z.coerce.number().int().positive().optional().nullable(),
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
  seoTitle: z.string().max(200).optional().or(z.literal('')),
  seoDescription: z.string().max(400).optional().or(z.literal('')),
});

categoriesRouter.get('/', requirePermission('categories.manage'), async (req, res) => {
  const cats = await prisma.category.findMany({
    where: { deletedAt: null },
    include: {
      _count: { select: { products: { where: { deletedAt: null } } } },
      children: { where: { deletedAt: null }, include: { _count: { select: { products: { where: { deletedAt: null } } } } } },
    },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
  const tree = cats
    .filter((c) => !c.parentId)
    .map((c) => ({
      id: c.id, name: c.name, nameAr: c.nameAr, slug: c.slug, sortOrder: c.sortOrder, isActive: c.isActive,
      imageUrl: c.imageUrl, bannerUrl: c.bannerUrl, productCount: c._count.products,
      children: c.children.map((ch) => ({
        id: ch.id, name: ch.name, nameAr: ch.nameAr, slug: ch.slug, sortOrder: ch.sortOrder, isActive: ch.isActive,
        imageUrl: ch.imageUrl, bannerUrl: ch.bannerUrl, productCount: ch._count.products,
      })),
    }));
  res.json({ success: true, data: tree });
});

categoriesRouter.get('/flat', requirePermission('categories.manage'), async (_req, res) => {
  const cats = await prisma.category.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } });
  res.json({ success: true, data: cats.map((c) => ({ id: c.id, name: c.name, parentId: c.parentId, slug: c.slug })) });
});

categoriesRouter.post('/', requirePermission('categories.manage'), validateBody(categorySchema), async (req, res) => {
  const data = req.body;
  const slug = data.slug?.trim() ? slugify(data.slug) : slugify(data.name);
  const exists = await prisma.category.findFirst({ where: { slug } });
  const finalSlug = exists ? `${slug}-${Date.now().toString(36).slice(-4)}` : slug;
  const cat = await prisma.category.create({
    data: {
      name: data.name.trim(), nameAr: data.nameAr || null, slug: finalSlug,
      description: data.description || null, descriptionAr: data.descriptionAr || null,
      imageUrl: data.imageUrl || null, bannerUrl: data.bannerUrl || null,
      parentId: data.parentId ?? null, sortOrder: data.sortOrder, isActive: data.isActive,
      seoTitle: data.seoTitle || null, seoDescription: data.seoDescription || null,
    },
  });
  await audit({ adminId: res.locals.admin.id, adminName: res.locals.admin.name, action: 'CATEGORY_CREATED', entityType: 'Category', entityId: String(cat.id), details: { name: cat.name }, ip: clientIp(req) });
  res.status(201).json({ success: true, data: cat });
});

categoriesRouter.patch('/:id', requirePermission('categories.manage'), validateBody(categorySchema.partial()), async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) throw AppError.notFound('Category not found');
  const data = req.body;
  const updateData: Record<string, unknown> = {};
  for (const k of ['name', 'nameAr', 'description', 'descriptionAr', 'imageUrl', 'bannerUrl', 'parentId', 'sortOrder', 'isActive', 'seoTitle', 'seoDescription']) {
    if (data[k] !== undefined) updateData[k] = data[k];
  }
  if (data.slug !== undefined) updateData.slug = slugify(data.slug || existing.name);
  const updated = await prisma.category.update({ where: { id }, data: updateData as never });
  await audit({ adminId: res.locals.admin.id, adminName: res.locals.admin.name, action: 'CATEGORY_UPDATED', entityType: 'Category', entityId: String(id), ip: clientIp(req) });
  res.json({ success: true, data: updated });
});

categoriesRouter.delete('/:id', requirePermission('categories.manage'), async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Category not found');
  await prisma.category.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  await prisma.product.updateMany({ where: { categoryId: id }, data: { categoryId: null } });
  await audit({ adminId: res.locals.admin.id, adminName: res.locals.admin.name, action: 'CATEGORY_DELETED', entityType: 'Category', entityId: String(id), ip: clientIp(req) });
  res.json({ success: true, data: { message: 'Category deleted' } });
});

// ---------------- Brands ----------------
const brandSchema = z.object({
  name: z.string().min(2).max(100),
  logoUrl: z.string().max(500).optional().or(z.literal('')),
  description: z.string().max(1000).optional().or(z.literal('')),
  isActive: z.boolean().default(true),
});

categoriesRouter.get('/brands', requirePermission('categories.manage'), async (_req, res) => {
  const brands = await prisma.brand.findMany({
    include: { _count: { select: { products: { where: { deletedAt: null } } } } },
    orderBy: { name: 'asc' },
  });
  res.json({ success: true, data: brands.map((b) => ({ id: b.id, name: b.name, slug: b.slug, logoUrl: b.logoUrl, description: b.description, isActive: b.isActive, productCount: b._count.products })) });
});

categoriesRouter.post('/brands', requirePermission('categories.manage'), validateBody(brandSchema), async (req, res) => {
  const slug = slugify(req.body.name);
  const exists = await prisma.brand.findFirst({ where: { slug } });
  const brand = await prisma.brand.create({
    data: { name: req.body.name.trim(), slug: exists ? `${slug}-${Date.now().toString(36).slice(-4)}` : slug, logoUrl: req.body.logoUrl || null, description: req.body.description || null, isActive: req.body.isActive },
  });
  await audit({ adminId: res.locals.admin.id, adminName: res.locals.admin.name, action: 'BRAND_CREATED', entityType: 'Brand', entityId: String(brand.id), ip: clientIp(req) });
  res.status(201).json({ success: true, data: brand });
});

categoriesRouter.patch('/brands/:id', requirePermission('categories.manage'), validateBody(brandSchema.partial()), async (req, res) => {
  const brand = await prisma.brand.update({ where: { id: Number(req.params.id) }, data: req.body as never });
  res.json({ success: true, data: brand });
});

categoriesRouter.delete('/brands/:id', requirePermission('categories.manage'), async (req, res) => {
  await prisma.brand.delete({ where: { id: Number(req.params.id) } });
  await prisma.product.updateMany({ where: { brandId: Number(req.params.id) }, data: { brandId: null } });
  res.json({ success: true, data: { message: 'Brand deleted' } });
});
