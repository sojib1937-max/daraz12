// COD checkout — the core money flow.
// Validates stock server-side, computes totals server-side (never trust the
// client), generates the order number, deducts stock, records analytics,
// triggers admin notifications + WhatsApp/SMS/email, and flags fraud.
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { validateBody } from '../middleware/validate';
import { orderLimiter } from '../lib/rateLimit';
import { generateOrderNumber, normalizeUaePhone, round2, emirateName } from '../lib/helpers';
import { getSettingsBulk } from '../lib/settings';
import { detectOrderRisks } from '../lib/fraud';
import { serializeOrder } from '../lib/serializers';
import { recordEvent, clientIp } from '../lib/analytics';
import { broadcastAdmin, broadcastPublic } from '../lib/sse';
import { sendEmail, sendSms, orderConfirmationSms } from '../lib/notifications';
import { loadCustomer } from '../middleware/auth';
import { maskName, timeAgo } from '../lib/helpers';
import { config } from '../config';

export const checkoutRouter = Router();
checkoutRouter.use(loadCustomer);

const EMIRATE_KEYS = ['DUBAI', 'ABU_DHABI', 'SHARJAH', 'AJMAN', 'UMM_AL_QUWAIN', 'RAS_AL_KHAIMAH', 'FUJAIRAH'];

const itemSchema = z.object({
  productId: z.number().int().positive(),
  variantId: z.number().int().positive().optional().nullable(),
  quantity: z.number().int().min(1).max(50),
});

const checkoutSchema = z.object({
  items: z.array(itemSchema).min(1, 'Your cart is empty').max(50),
  customer: z.object({
    name: z.string().min(2, 'Enter your full name').max(80),
    phone: z.string().min(8, 'Enter a valid UAE mobile number').max(16),
    email: z.string().email('Enter a valid email').optional().or(z.literal('')),
    emirate: z.enum(EMIRATE_KEYS as [string, ...string[]]),
    area: z.string().min(2, 'Enter your area / city').max(100),
    address: z.string().min(5, 'Enter your full address').max(200),
    building: z.string().max(100).optional().or(z.literal('')),
    apartment: z.string().max(50).optional().or(z.literal('')),
    landmark: z.string().max(100).optional().or(z.literal('')),
    notes: z.string().max(500).optional().or(z.literal('')),
  }),
  couponCode: z.string().max(50).optional().or(z.literal('')),
  guestId: z.string().max(64).optional(),
  progress: z.string().max(20).optional(),
});

async function computeTotals(
  items: { productId: number; variantId?: number | null; quantity: number }[],
  emirate: string,
  couponCode?: string
) {
  const [settings, zoneRows] = await Promise.all([
    getSettingsBulk([
      'shipping.zones', 'shipping.freeShippingThreshold', 'shipping.minOrderAmount', 'shipping.codFee',
      'shipping.codAvailable', 'shipping.deliveryEstimateDays', 'orders.prefix',
    ]),
    prisma.shippingZone.findMany({ where: { isActive: true } }),
  ]);

  // Load products + variants
  const products = await prisma.product.findMany({
    where: { id: { in: items.map((i) => i.productId) }, status: 'PUBLISHED', deletedAt: null },
    include: { flashSaleItems: { include: { flashSale: true } }, images: { take: 1, orderBy: { sortOrder: 'asc' } } },
  });
  if (products.length !== items.length) throw AppError.badRequest('One or more products are no longer available');

  const lineItems: {
    product: (typeof products)[number];
    variant?: { id: number; name: string; sku: string; priceDelta: number; stock: number } | null;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }[] = [];

  let subtotal = 0;
  for (const item of items) {
    const product = products.find((p) => p.id === item.productId)!;
    const activeFlash = product.flashSaleItems.find(
      (f) => f.isActive && f.flashSale.isActive && f.flashSale.startsAt <= new Date() && f.flashSale.endsAt > new Date()
    );
    let unitPrice = activeFlash ? Number(activeFlash.salePrice) : Number(product.price);

    let variant: { id: number; name: string; sku: string; priceDelta: number; stock: number } | null = null;
    if (item.variantId) {
      const v = await prisma.productVariant.findUnique({ where: { id: item.variantId } });
      if (!v || v.productId !== product.id) throw AppError.badRequest('Invalid variant selected');
      if (v.stock < item.quantity) throw AppError.badRequest(`Only ${v.stock} of "${v.name}" left in stock`);
      variant = { id: v.id, name: v.name, sku: v.sku, priceDelta: Number(v.priceDelta), stock: v.stock };
      unitPrice = unitPrice + Number(v.priceDelta);
    }

    if (product.stock < item.quantity) {
      throw AppError.badRequest(`"${product.title}" only has ${product.stock} left in stock`);
    }

    const totalPrice = round2(unitPrice * item.quantity);
    subtotal += totalPrice;
    lineItems.push({ product, variant, quantity: item.quantity, unitPrice: round2(unitPrice), totalPrice });
  }
  subtotal = round2(subtotal);

  // Coupon
  let discount = 0;
  let coupon = null;
  if (couponCode) {
    coupon = await prisma.coupon.findUnique({ where: { code: couponCode.trim().toUpperCase() } });
    if (!coupon || !coupon.isActive) throw AppError.badRequest('Invalid coupon code');
    const now = new Date();
    if (coupon.startsAt && coupon.startsAt > now) throw AppError.badRequest('This coupon is not active yet');
    if (coupon.expiresAt && coupon.expiresAt < now) throw AppError.badRequest('This coupon has expired');
    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) throw AppError.badRequest('This coupon has reached its usage limit');
    if (coupon.minOrderAmount && subtotal < Number(coupon.minOrderAmount)) {
      throw AppError.badRequest(`This coupon requires a minimum order of AED ${Number(coupon.minOrderAmount).toFixed(2)}`);
    }
    if (coupon.type === 'PERCENTAGE') {
      discount = (subtotal * Number(coupon.value)) / 100;
      if (coupon.maxDiscount) discount = Math.min(discount, Number(coupon.maxDiscount));
    } else if (coupon.type === 'FIXED') {
      discount = Math.min(Number(coupon.value), subtotal);
    } else if (coupon.type === 'FREE_SHIPPING') {
      discount = 0; // shipping fee zeroed below
    }
    discount = round2(discount);
  }

  // Shipping fee — per-zone from DB (admin editable) or default zones from settings
  const zones = (settings['shipping.zones'] as { name: string; emirates: string[]; fee: number; codFee: number; isActive?: boolean }[]) || [];
  const dbZones = zoneRows.map((z) => ({ name: z.name, emirates: z.emirates, fee: Number(z.fee), codFee: Number(z.codFee) }));
  const allZones = [...dbZones, ...zones.filter((z) => !dbZones.some((d) => d.name === z.name))];
  const zone = allZones.find((z) => z.emirates.includes(emirate) || z.emirates.includes('ALL')) || allZones[0];
  const baseShipping = zone ? zone.fee : 15;

  const freeShippingThreshold = Number(settings['shipping.freeShippingThreshold']) || 0;
  const codAvailable = settings['shipping.codAvailable'] !== false;
  const minOrder = Number(settings['shipping.minOrderAmount']) || 0;

  if (subtotal - discount < minOrder) {
    throw AppError.badRequest(`Minimum order amount is AED ${minOrder.toFixed(2)}`);
  }

  let shippingFee = baseShipping;
  if (coupon?.type === 'FREE_SHIPPING') shippingFee = 0;
  else if (freeShippingThreshold > 0 && subtotal - discount >= freeShippingThreshold) shippingFee = 0;

  const codFee = codAvailable && zone ? zone.codFee : 0;

  const total = round2(subtotal - discount + shippingFee + codFee);
  const deliveryEstimate = String(settings['shipping.deliveryEstimateDays'] || '1-3 business days');

  return { lineItems, subtotal, discount, shippingFee, codFee, total, deliveryEstimate, prefix: String(settings['orders.prefix'] || 'DXB') };
}

checkoutRouter.post('/cod', orderLimiter, validateBody(checkoutSchema), async (req, res) => {
  const { items, customer, couponCode, guestId, progress } = req.body;

  const normalizedPhone = normalizeUaePhone(customer.phone);
  if (!normalizedPhone) throw AppError.badRequest('Enter a valid UAE mobile number (05XXXXXXXX or +9715XXXXXXXX)');

  const totals = await computeTotals(items, customer.emirate, couponCode);
  const orderNumber = await generateOrderNumber(totals.prefix);

  // Resolve or create customer record (guest checkout allowed — no password)
  let customerId: number | null = null;
  const existing = await prisma.customer.findUnique({ where: { phone: normalizedPhone } });
  if (existing) {
    customerId = existing.id;
  } else {
    const created = await prisma.customer.create({
      data: {
        name: customer.name.trim(),
        phone: normalizedPhone,
        email: customer.email?.trim() || null,
      },
    });
    customerId = created.id;
  }

  // Fraud / duplicate detection (flags only — never auto-rejects)
  const riskFlags = await detectOrderRisks({
    phone: normalizedPhone,
    items: items.map((i: { productId: number; quantity: number }) => ({ productId: i.productId, quantity: i.quantity })),
    total: totals.total,
  });

  const isDemo = config.demoMode;

  // Create order + items + history + coupon usage + stock decrement atomically
  const order = await prisma.$transaction(async (tx) => {
    // Re-verify stock inside the transaction (race-safe)
    for (const li of totals.lineItems) {
      const fresh = await tx.product.findUnique({ where: { id: li.product.id }, select: { stock: true } });
      if (!fresh || fresh.stock < li.quantity) {
        throw AppError.badRequest(`"${li.product.title}" is out of stock. Please remove it from your cart.`);
      }
    }
    const created = await tx.order.create({
      data: {
        orderNumber,
        customerId,
        customerName: customer.name.trim(),
        customerPhone: normalizedPhone,
        customerEmail: customer.email?.trim() || null,
        emirate: customer.emirate,
        area: customer.area,
        address: customer.address,
        building: customer.building || null,
        apartment: customer.apartment || null,
        landmark: customer.landmark || null,
        notes: customer.notes || null,
        subtotal: totals.subtotal,
        discount: totals.discount,
        shippingFee: totals.shippingFee,
        codFee: totals.codFee,
        total: totals.total,
        status: 'NEW',
        couponCode: couponCode ? couponCode.trim().toUpperCase() : null,
        riskFlags: riskFlags as never,
        isDemo,
        deliveryEstimate: totals.deliveryEstimate,
        ip: clientIp(req),
        items: {
          create: totals.lineItems.map((li) => ({
            productId: li.product.id,
            productTitle: li.product.title,
            productTitleAr: li.product.titleAr,
            sku: li.variant ? li.variant.sku : li.product.sku,
            variantId: li.variant?.id ?? null,
            variantName: li.variant?.name ?? null,
            quantity: li.quantity,
            unitPrice: li.unitPrice,
            totalPrice: li.totalPrice,
            imageUrl: li.product.images[0]?.url ?? null,
          })),
        },
        statusHistory: {
          create: { status: 'NEW', changedByName: 'Customer' },
        },
      },
      include: { items: true },
    });

    // Decrement stock
    for (const li of totals.lineItems) {
      await tx.product.update({
        where: { id: li.product.id },
        data: {
          stock: { decrement: li.quantity },
          soldCount: { increment: li.quantity },
        },
      });
      if (li.variant) {
        await tx.productVariant.update({ where: { id: li.variant.id }, data: { stock: { decrement: li.quantity } } });
      }
    }

    // Coupon usage
    if (totals.discount > 0 && couponCode) {
      const coupon = await tx.coupon.findUnique({ where: { code: couponCode.trim().toUpperCase() } });
      if (coupon) {
        await tx.coupon.update({ where: { id: coupon.id }, data: { usageCount: { increment: 1 } } });
        await tx.couponUsage.create({
          data: { couponId: coupon.id, orderId: created.id, customerId, phone: normalizedPhone, discountAmount: totals.discount },
        });
      }
    }

    // Update customer lastOrderAt
    await tx.customer.update({ where: { id: customerId! }, data: { lastOrderAt: new Date() } });

    // Track flash sale sold counts
    for (const li of totals.lineItems) {
      const fsItem = li.product.flashSaleItems.find((f) => f.isActive && f.flashSale.isActive);
      if (fsItem) {
        await tx.flashSaleItem.update({ where: { id: fsItem.id }, data: { soldCount: { increment: li.quantity } } });
      }
    }

    return created;
  });

  // Abandoned-cart session update
  if (guestId) {
    prisma.cartSession
      .upsert({
        where: { id: guestId },
        create: {
          id: guestId,
          guestId,
          customerId,
          items: items as never,
          progress: 'PLACED',
          expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
        },
        update: { customerId, progress: 'PLACED', items: items as never },
      })
      .catch(() => undefined);
  }

  // Analytics
  recordEvent({
    type: 'ORDER_PLACED',
    sessionId: req.cookies?.dc_visitor || guestId,
    ip: clientIp(req),
    meta: { orderNumber, total: totals.total, emirate: customer.emirate },
  });

  // ---- Real-time admin notification ----
  const settings = await getSettingsBulk([
    'notifications.adminNewOrderEnabled', 'store.whatsapp', 'store.email', 'store.phone',
  ]);
  if (settings['notifications.adminNewOrderEnabled'] !== false) {
    await prisma.notification.create({
      data: {
        type: 'NEW_ORDER',
        title: 'New COD Order',
        body: `Order #${orderNumber} • AED ${totals.total.toFixed(2)} • ${emirateName(customer.emirate)}`,
        data: { orderNumber, total: totals.total, emirate: customer.emirate, customerName: maskName(customer.name), items: totals.lineItems.length } as never,
      },
    });
    broadcastAdmin('new-order', {
      orderNumber,
      total: totals.total,
      emirate: customer.emirate,
      emirateLabel: emirateName(customer.emirate),
      customerName: maskName(customer.name),
      itemCount: totals.lineItems.reduce((a, i) => a + i.quantity, 0),
      time: new Date().toISOString(),
      demo: isDemo,
    });
  }

  // ---- Public social-proof event (masked, real order data only) ----
  const popupSettings = await getSettingsBulk(['popups.salesEnabled', 'popups.salesMaskNames', 'popups.salesUseDemoWhenEmpty']);
  if (popupSettings['popups.salesEnabled'] !== false) {
    const firstItem = totals.lineItems[0];
    broadcastPublic('recent-sale', {
      id: order.id,
      productTitle: firstItem.product.title,
      productImage: firstItem.product.images[0]?.url || null,
      productSlug: firstItem.product.slug,
      emirate: emirateName(customer.emirate),
      customerInitial: popupSettings['popups.salesMaskNames'] !== false ? maskName(customer.name) : null,
      timeAgoEn: timeAgo(new Date()).labelEn,
      timeAgoAr: timeAgo(new Date()).labelAr,
      demo: isDemo,
    });
  }

  // ---- Outbound notifications (email / SMS / WhatsApp) ----
  if (customer.email) {
    sendEmail({
      to: customer.email,
      subject: `Order Confirmed — ${orderNumber}`,
      text: `Hello ${customer.name},\n\nThank you for your order!\n\nOrder: ${orderNumber}\nTotal: AED ${totals.total.toFixed(2)} (pay on delivery)\nDelivery to: ${emirateName(customer.emirate)} — ${customer.area}\nEstimated delivery: ${totals.deliveryEstimate}\n\nTrack your order: ${config.appUrl}/track-order?orderId=${orderNumber}\n\nDesertCart`,
    }).catch(() => undefined);
  }
  sendSms(normalizedPhone, orderConfirmationSms({ orderNumber, total: totals.total.toFixed(2), emirate: emirateName(customer.emirate), items: totals.lineItems.map((i) => `${i.quantity}x ${i.product.title}`).join(', ').slice(0, 120) })).catch(() => undefined);

  const dto = serializeOrder({ ...order, statusHistory: [], customer: null });
  res.status(201).json({
    success: true,
    data: {
      order: dto,
      message: 'Order placed successfully! Pay cash on delivery.',
    },
  });
});

// Shipping estimate for checkout preview (cart page)
checkoutRouter.post('/shipping-estimate', async (req, res) => {
  const { items, emirate, couponCode } = z
    .object({
      items: z.array(itemSchema).min(1),
      emirate: z.enum(EMIRATE_KEYS as [string, ...string[]]).optional(),
      couponCode: z.string().max(50).optional().or(z.literal('')),
    })
    .parse(req.body);
  if (!emirate) return res.json({ success: true, data: { subtotal: 0, shippingFee: 0, codFee: 0, discount: 0, total: 0, requiresSelection: true } });
  const totals = await computeTotals(items, emirate, couponCode);
  res.json({
    success: true,
    data: {
      subtotal: totals.subtotal,
      shippingFee: totals.shippingFee,
      codFee: totals.codFee,
      discount: totals.discount,
      total: totals.total,
      deliveryEstimate: totals.deliveryEstimate,
    },
  });
});
