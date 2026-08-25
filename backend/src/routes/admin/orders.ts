// Admin order management: list/filter/search, detail, status changes with
// history, internal notes, courier/tracking, invoice + packing slip,
// CSV export, bulk status updates, WhatsApp message templates.
import { Router } from 'express';
import { z } from 'zod';
import { Prisma, OrderStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../lib/errors';
import { requirePermission } from '../../middleware/adminAuth';
import { validateBody, validateQuery } from '../../middleware/validate';
import { serializeOrder } from '../../lib/serializers';
import { audit } from '../../lib/audit';
import { csvDownload } from '../../lib/csv';
import { emirateName } from '../../lib/helpers';
import { getSettingsBulk, getSetting } from '../../lib/settings';
import { broadcastAdmin } from '../../lib/sse';
import { sendSms, orderStatusSms } from '../../lib/notifications';
import { clientIp } from '../../lib/analytics';

export const ordersRouter = Router();

export const ORDER_STATUSES: OrderStatus[] = [
  'NEW', 'CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY',
  'DELIVERED', 'CANCELLED', 'RETURN_REQUESTED', 'RETURNED', 'FAILED_DELIVERY', 'COD_COLLECTED',
];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: 'New', CONFIRMED: 'Confirmed', PROCESSING: 'Processing', PACKED: 'Packed',
  SHIPPED: 'Shipped', OUT_FOR_DELIVERY: 'Out for delivery', DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled', RETURN_REQUESTED: 'Return requested', RETURNED: 'Returned',
  FAILED_DELIVERY: 'Failed delivery', COD_COLLECTED: 'COD Collected',
};

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().max(100).optional(), // order number, phone, name
  status: z.string().max(30).optional(),
  emirate: z.string().max(30).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  product: z.string().max(100).optional(),
  flagged: z.enum(['true', 'false']).optional(),
  demo: z.enum(['true', 'false']).optional(),
});

ordersRouter.get('/', requirePermission('orders.view'), validateQuery(listSchema), async (req, res) => {
  const q = (req as unknown as { validatedQuery: z.infer<typeof listSchema> }).validatedQuery;
  const where: Prisma.OrderWhereInput = {};
  if (q.q) {
    where.OR = [
      { orderNumber: { contains: q.q.toUpperCase() } },
      { customerName: { contains: q.q, mode: 'insensitive' } },
      { customerPhone: { contains: q.q } },
      { customerEmail: { contains: q.q, mode: 'insensitive' } },
      { trackingNumber: { contains: q.q } },
    ];
  }
  if (q.status && q.status !== 'ALL') where.status = q.status as OrderStatus;
  if (q.emirate && q.emirate !== 'ALL') where.emirate = q.emirate;
  if (q.dateFrom || q.dateTo) {
    where.placedAt = {
      ...(q.dateFrom ? { gte: new Date(`${q.dateFrom}T00:00:00`) } : {}),
      ...(q.dateTo ? { lte: new Date(`${q.dateTo}T23:59:59`) } : {}),
    };
  }
  if (q.flagged === 'true') where.riskFlags = { not: '[]' };
  if (q.demo === 'true') where.isDemo = true;
  if (q.demo === 'false') where.isDemo = false;
  if (q.product) {
    where.items = { some: { productTitle: { contains: q.product, mode: 'insensitive' } } };
  }

  const [total, items, summary] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      include: { items: true },
      orderBy: { placedAt: 'desc' },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    }),
    prisma.order.groupBy({ by: ['status'], where, _count: true }),
  ]);

  res.json({
    success: true,
    data: {
      items: items.map((o) => ({
        id: o.id, orderNumber: o.orderNumber, customerName: o.customerName, customerPhone: o.customerPhone,
        emirate: o.emirate, emirateLabel: emirateName(o.emirate), total: Number(o.total),
        status: o.status, isDemo: o.isDemo, placedAt: o.placedAt.toISOString(),
        itemCount: o.items.reduce((a, i) => a + i.quantity, 0),
        riskCount: Array.isArray(o.riskFlags) ? o.riskFlags.length : 0,
        courierName: o.courierName, trackingNumber: o.trackingNumber,
      })),
      statusCounts: Object.fromEntries(summary.map((s) => [s.status, s._count])),
      pagination: { page: q.page, limit: q.limit, total, pages: Math.max(1, Math.ceil(total / q.limit)) },
    },
  });
});

ordersRouter.get('/export', requirePermission('orders.export'), validateQuery(listSchema), async (req, res) => {
  const q = (req as unknown as { validatedQuery: z.infer<typeof listSchema> }).validatedQuery;
  const where: Prisma.OrderWhereInput = {};
  if (q.status && q.status !== 'ALL') where.status = q.status as OrderStatus;
  if (q.dateFrom || q.dateTo) {
    where.placedAt = {
      ...(q.dateFrom ? { gte: new Date(`${q.dateFrom}T00:00:00`) } : {}),
      ...(q.dateTo ? { lte: new Date(`${q.dateTo}T23:59:59`) } : {}),
    };
  }
  const orders = await prisma.order.findMany({
    where,
    include: { items: true },
    orderBy: { placedAt: 'desc' },
    take: 5000,
  });
  const rows = orders.flatMap((o) =>
    o.items.map((i) => ({
      order_number: o.orderNumber, date: o.placedAt.toISOString(), status: o.status,
      customer: o.customerName, phone: o.customerPhone, emirate: emirateName(o.emirate),
      area: o.area, address: o.address, product: i.productTitle, variant: i.variantName || '',
      quantity: i.quantity, unit_price: Number(i.unitPrice), line_total: Number(i.totalPrice),
      subtotal: Number(o.subtotal), discount: Number(o.discount), shipping: Number(o.shippingFee),
      cod_fee: Number(o.codFee), total: Number(o.total), courier: o.courierName || '', tracking: o.trackingNumber || '',
      demo: o.isDemo ? 'yes' : 'no',
    }))
  );
  csvDownload(res, `orders-${new Date().toISOString().slice(0, 10)}.csv`, rows);
});

ordersRouter.get('/:id', requirePermission('orders.view'), async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: Number(req.params.id) },
    include: { items: true, statusHistory: { orderBy: { createdAt: 'asc' } }, customer: { select: { id: true, name: true, phone: true, email: true, notes: true, createdAt: true, lastOrderAt: true } } },
  });
  if (!order) throw AppError.notFound('Order not found');
  const customerOrders = order.customerId
    ? await prisma.order.findMany({ where: { customerId: order.customerId, id: { not: order.id } }, select: { orderNumber: true, status: true, total: true, placedAt: true }, orderBy: { placedAt: 'desc' }, take: 10 })
    : [];
  res.json({ success: true, data: { order: serializeOrder({ ...order, customer: null }), customer: order.customer, customerOrders } });
});

const statusSchema = z.object({
  status: z.enum(ORDER_STATUSES as [OrderStatus, ...OrderStatus[]]),
  note: z.string().max(500).optional().or(z.literal('')),
  notifyCustomer: z.boolean().optional(),
});

ordersRouter.patch('/:id/status', requirePermission('orders.update'), validateBody(statusSchema), async (req, res) => {
  const id = Number(req.params.id);
  const order = await prisma.order.findUnique({ where: { id }, include: { items: { take: 1 } } });
  if (!order) throw AppError.notFound('Order not found');
  const { status, note, notifyCustomer } = req.body as { status: OrderStatus; note?: string; notifyCustomer?: boolean };

  const updated = await prisma.order.update({
    where: { id },
    data: {
      status,
      ...(status === 'DELIVERED' ? { deliveredAt: new Date() } : {}),
      ...(status === 'CANCELLED' || status === 'RETURNED' ? { cancelledAt: new Date() } : {}),
      statusHistory: {
        create: {
          status,
          note: note || null,
          changedById: res.locals.admin.id,
          changedByName: res.locals.admin.name,
        },
      },
    },
  });

  await prisma.notification.create({
    data: {
      type: 'ORDER_STATUS',
      title: `Order ${updated.orderNumber} → ${STATUS_LABELS[status]}`,
      body: `${updated.customerName} • AED ${Number(updated.total).toFixed(2)}`,
      data: { orderNumber: updated.orderNumber, status } as never,
    },
  });
  broadcastAdmin('order-update', {
    orderNumber: updated.orderNumber, status, orderId: updated.id,
    message: `Order ${updated.orderNumber} is now ${STATUS_LABELS[status]}`,
  });

  // Notify customer via SMS (if enabled by admin flag; SMS driver configurable)
  if (notifyCustomer) {
    sendSms(updated.customerPhone, orderStatusSms(updated.orderNumber, STATUS_LABELS[status])).catch(() => undefined);
  }

  await audit({
    adminId: res.locals.admin.id, adminName: res.locals.admin.name, action: 'ORDER_STATUS_CHANGED',
    entityType: 'Order', entityId: String(id),
    details: { orderNumber: updated.orderNumber, from: order.status, to: status, note: note || '' },
    ip: clientIp(req),
  });

  res.json({ success: true, data: { message: `Order marked as ${STATUS_LABELS[status]}` } });
});

const updateSchema = z.object({
  courierName: z.string().max(100).optional().or(z.literal('')),
  trackingNumber: z.string().max(100).optional().or(z.literal('')),
  adminNote: z.string().max(2000).optional().or(z.literal('')),
});

ordersRouter.patch('/:id', requirePermission('orders.update'), validateBody(updateSchema), async (req, res) => {
  const id = Number(req.params.id);
  await prisma.order.update({ where: { id }, data: req.body });
  await audit({ adminId: res.locals.admin.id, adminName: res.locals.admin.name, action: 'ORDER_UPDATED', entityType: 'Order', entityId: String(id), details: req.body, ip: clientIp(req) });
  res.json({ success: true, data: { message: 'Order updated' } });
});

ordersRouter.post('/:id/notes', requirePermission('orders.update'), validateBody(z.object({ note: z.string().min(1).max(2000) })), async (req, res) => {
  const id = Number(req.params.id);
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) throw AppError.notFound('Order not found');
  const existing = order.adminNote ? `${order.adminNote}\n` : '';
  const timestamp = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Dubai' });
  await prisma.order.update({
    where: { id },
    data: { adminNote: `${existing}[${res.locals.admin.name} ${timestamp}] ${req.body.note}`.slice(0, 4000) },
  });
  res.json({ success: true, data: { message: 'Note added' } });
});

// Bulk status update
ordersRouter.post('/bulk-status', requirePermission('orders.update'), async (req, res) => {
  const { ids, status } = z.object({
    ids: z.array(z.number().int().positive()).min(1).max(500),
    status: z.enum(ORDER_STATUSES as [OrderStatus, ...OrderStatus[]]),
  }).parse(req.body);

  await prisma.$transaction(async (tx) => {
    for (const id of ids) {
      await tx.order.update({
        where: { id },
        data: {
          status,
          ...(status === 'DELIVERED' ? { deliveredAt: new Date() } : {}),
          statusHistory: {
            create: { status, changedById: res.locals.admin.id, changedByName: res.locals.admin.name, note: 'Bulk update' },
          },
        },
      });
    }
  });
  await audit({ adminId: res.locals.admin.id, adminName: res.locals.admin.name, action: 'ORDERS_BULK_STATUS', entityType: 'Order', details: { ids, status }, ip: clientIp(req) });
  res.json({ success: true, data: { updated: ids.length } });
});

// Invoice / packing slip (HTML — printable)
ordersRouter.get('/:id/invoice', requirePermission('orders.view'), async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: Number(req.params.id) }, include: { items: true } });
  if (!order) throw AppError.notFound('Order not found');
  const settings = await getSettingsBulk(['store.name', 'store.logo', 'store.phone', 'store.email', 'store.address', 'store.whatsapp']);
  res.setHeader('Content-Type', 'text/html');
  res.send(printDoc(order, settings, 'INVOICE'));
});

ordersRouter.get('/:id/packing-slip', requirePermission('orders.view'), async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: Number(req.params.id) }, include: { items: true } });
  if (!order) throw AppError.notFound('Order not found');
  const settings = await getSettingsBulk(['store.name', 'store.logo', 'store.phone', 'store.email', 'store.address', 'store.whatsapp']);
  res.setHeader('Content-Type', 'text/html');
  res.send(printDoc(order, settings, 'PACKING SLIP'));
});

function printDoc(
  order: { orderNumber: string; customerName: string; customerPhone: string; emirate: string; area: string; address: string; building: string | null; apartment: string | null; landmark: string | null; items: { productTitle: string; variantName: string | null; quantity: number; unitPrice: unknown; totalPrice: unknown }[]; subtotal: unknown; discount: unknown; shippingFee: unknown; codFee: unknown; total: unknown; placedAt: Date; courierName: string | null; trackingNumber: string | null; notes: string | null },
  settings: Record<string, unknown>,
  kind: string
) {
  const itemsHtml = order.items
    .map(
      (i) => `<tr><td>${escapeHtml(i.productTitle)}${i.variantName ? `<br><small>${escapeHtml(i.variantName)}</small>` : ''}</td><td>${i.quantity}</td><td>AED ${Number(i.unitPrice).toFixed(2)}</td><td class="r">AED ${Number(i.totalPrice).toFixed(2)}</td></tr>`
    )
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${kind} ${escapeHtml(order.orderNumber)}</title>
<style>
 body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:32px}
 h1{font-size:20px;margin:0} .muted{color:#666;font-size:12px}
 table{width:100%;border-collapse:collapse;margin:16px 0}
 th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left;font-size:13px}
 .r{text-align:right} .totals td{border:none;padding:3px 8px;font-size:13px}
 .totals tr:last-child td{font-weight:bold;font-size:15px;border-top:2px solid #333}
 .grid{display:flex;gap:40px;margin:16px 0} .col{flex:1;font-size:13px;line-height:1.6}
 .badge{display:inline-block;background:#0f5132;color:#fff;padding:4px 10px;border-radius:4px;font-size:12px}
 @media print{.no-print{display:none}}
</style></head><body>
 <button class="no-print" onclick="window.print()" style="position:fixed;top:12px;right:12px;padding:8px 16px">Print / Save PDF</button>
 <div style="display:flex;justify-content:space-between;align-items:start">
   <div><h1>${escapeHtml(String(settings['store.name'] || 'DesertCart'))}</h1>
   <div class="muted">${escapeHtml(String(settings['store.address'] || ''))}<br>${escapeHtml(String(settings['store.phone'] || ''))} • ${escapeHtml(String(settings['store.email'] || ''))}</div></div>
   <div style="text-align:right"><div class="badge">${kind}</div>
   <h1 style="margin-top:8px">${escapeHtml(order.orderNumber)}</h1>
   <div class="muted">${order.placedAt.toLocaleString('en-GB', { timeZone: 'Asia/Dubai' })}</div></div>
 </div>
 <div class="grid">
   <div class="col"><b>Deliver to</b><br>${escapeHtml(order.customerName)}<br>${escapeHtml(order.customerPhone)}<br>
     ${escapeHtml(order.building || '')} ${escapeHtml(order.apartment || '')} ${escapeHtml(order.area)} — ${escapeHtml(order.emirate)}<br>${escapeHtml(order.address)}
     ${order.landmark ? `<br>Landmark: ${escapeHtml(order.landmark)}` : ''}</div>
   <div class="col"><b>Courier</b><br>${escapeHtml(order.courierName || '—')}<br>Tracking: ${escapeHtml(order.trackingNumber || '—')}</div>
 </div>
 <table><thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th class="r">Total</th></tr></thead><tbody>${itemsHtml}</tbody></table>
 <table class="totals"><tr><td></td><td></td><td>Subtotal</td><td class="r">AED ${Number(order.subtotal).toFixed(2)}</td></tr>
 <tr><td></td><td></td><td>Discount</td><td class="r">-AED ${Number(order.discount).toFixed(2)}</td></tr>
 <tr><td></td><td></td><td>Shipping</td><td class="r">AED ${Number(order.shippingFee).toFixed(2)}</td></tr>
 <tr><td></td><td></td><td>COD fee</td><td class="r">AED ${Number(order.codFee).toFixed(2)}</td></tr>
 <tr><td></td><td></td><td>Total (cash on delivery)</td><td class="r">AED ${Number(order.total).toFixed(2)}</td></tr></table>
 ${order.notes ? `<div class="muted">Notes: ${escapeHtml(order.notes)}</div>` : ''}
 <div class="muted" style="margin-top:24px">Thank you for shopping with ${escapeHtml(String(settings['store.name'] || 'DesertCart'))}.</div>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

// WhatsApp order message template (admin helper)
ordersRouter.get('/:id/whatsapp', requirePermission('orders.view'), async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: Number(req.params.id) } });
  if (!order) throw AppError.notFound('Order not found');
  const storeName = await getSetting<string>('store.name');
  const message = `Hello ${order.customerName}! 👋\n\nYour order *${order.orderNumber}* (AED ${Number(order.total).toFixed(2)}) with ${storeName} is ${STATUS_LABELS[order.status]}.${order.trackingNumber ? `\nTracking: ${order.trackingNumber}` : ''}\n\nThank you for shopping with us!`;
  res.json({ success: true, data: { message } });
});
