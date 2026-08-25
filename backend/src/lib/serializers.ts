// Consistent API shapes for products, orders, etc.
// Decimals are converted to numbers for JSON; flash-sale pricing is resolved.
import { Prisma } from '@prisma/client';

type ProductWithRelations = Prisma.ProductGetPayload<{
  include: { images: true; variants: true; category: { select: { id: true; name: true; slug: true; nameAr: true } }; brand: { select: { id: true; name: true; slug: true } }; flashSaleItems: { include: { flashSale: true } } };
}>;

export function serializeProduct(p: ProductWithRelations, lang: 'en' | 'ar' = 'en') {
  const activeFlash = p.flashSaleItems?.find(
    (f) => f.isActive && f.flashSale.isActive && f.flashSale.startsAt <= new Date() && f.flashSale.endsAt > new Date()
  );
  const price = Number(p.price);
  const compareAt = p.compareAtPrice ? Number(p.compareAtPrice) : null;
  const flashPrice = activeFlash ? Number(activeFlash.salePrice) : null;
  const finalPrice = flashPrice ?? price;
  const discountPercent = flashPrice
    ? Math.round(((compareAt || price) - flashPrice) / (compareAt || price) * 100)
    : p.discountPercent ?? (compareAt && compareAt > price ? Math.round(((compareAt - price) / compareAt) * 100) : null);

  return {
    id: p.id,
    sku: p.sku,
    slug: p.slug,
    title: lang === 'ar' && p.titleAr ? p.titleAr : p.title,
    titleEn: p.title,
    titleAr: p.titleAr,
    description: lang === 'ar' && p.descriptionAr ? p.descriptionAr : p.description,
    descriptionEn: p.description,
    descriptionAr: p.descriptionAr,
    price,
    compareAtPrice: compareAt,
    flashPrice,
    flashSaleEndsAt: activeFlash ? activeFlash.flashSale.endsAt.toISOString() : null,
    discountPercent,
    stock: p.stock,
    lowStockThreshold: p.lowStockThreshold,
    category: p.category ? { id: p.category.id, name: p.category.name, nameAr: p.category.nameAr, slug: p.category.slug } : null,
    brand: p.brand ? { id: p.brand.id, name: p.brand.name, slug: p.brand.slug } : null,
    images: p.images
      .sort((a, b) => a.sortOrder - b.sortOrder || (a.isThumbnail ? -1 : 1))
      .map((i) => ({ id: i.id, url: i.url, alt: lang === 'ar' && i.altAr ? i.altAr : i.alt })),
    thumbnail: p.images.find((i) => i.isThumbnail)?.url || p.images[0]?.url || '',
    variants: p.variants.map((v) => ({
      id: v.id,
      name: v.name,
      size: v.size,
      color: v.color,
      price: price + Number(v.priceDelta),
      stock: v.stock,
      sku: v.sku,
      imageUrl: v.imageUrl,
    })),
    ratingAvg: Number(p.ratingAvg),
    ratingCount: p.ratingCount,
    soldCount: p.soldCount,
    weightKg: p.weightKg ? Number(p.weightKg) : null,
    dimensions: p.dimensions,
    shippingNote: lang === 'ar' && p.shippingNoteAr ? p.shippingNoteAr : p.shippingNote,
    specifications: p.specifications as { label: string; value: string }[] | null,
    tags: p.tags,
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
    videoUrl: p.videoUrl,
    isFeatured: p.isFeatured,
    isBestSeller: p.isBestSeller,
    isRecommended: p.isRecommended,
    inFlashSale: !!activeFlash,
    createdAt: p.createdAt.toISOString(),
  };
}

export type ProductDto = ReturnType<typeof serializeProduct>;

const orderInclude = {
  items: true,
  statusHistory: { orderBy: { createdAt: 'desc' as const }, take: 30 },
  customer: { select: { id: true, name: true, phone: true } },
} as const;

type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

export function serializeOrder(o: OrderWithRelations) {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    customerId: o.customerId,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    customerEmail: o.customerEmail,
    emirate: o.emirate,
    area: o.area,
    address: o.address,
    building: o.building,
    apartment: o.apartment,
    landmark: o.landmark,
    notes: o.notes,
    subtotal: Number(o.subtotal),
    discount: Number(o.discount),
    shippingFee: Number(o.shippingFee),
    codFee: Number(o.codFee),
    total: Number(o.total),
    status: o.status,
    couponCode: o.couponCode,
    riskFlags: (o.riskFlags as unknown[]) ?? [],
    isDemo: o.isDemo,
    courierName: o.courierName,
    trackingNumber: o.trackingNumber,
    adminNote: o.adminNote,
    deliveryEstimate: o.deliveryEstimate,
    placedAt: o.placedAt.toISOString(),
    deliveredAt: o.deliveredAt?.toISOString() ?? null,
    cancelledAt: o.cancelledAt?.toISOString() ?? null,
    items: o.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      title: i.productTitle,
      titleAr: i.productTitleAr,
      sku: i.sku,
      variantName: i.variantName,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
      totalPrice: Number(i.totalPrice),
      imageUrl: i.imageUrl,
    })),
    statusHistory: o.statusHistory.map((h) => ({
      status: h.status,
      note: h.note,
      changedByName: h.changedByName,
      createdAt: h.createdAt.toISOString(),
    })),
  };
}

export type OrderDto = ReturnType<typeof serializeOrder>;
