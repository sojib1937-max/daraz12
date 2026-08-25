// Admin customer management.
import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../lib/errors';
import { requirePermission } from '../../middleware/adminAuth';
import { validateQuery } from '../../middleware/validate';
import { csvDownload } from '../../lib/csv';
import { emirateName } from '../../lib/helpers';
import { audit } from '../../lib/audit';
import { clientIp } from '../../lib/analytics';

export const customersRouter = Router();

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().max(100).optional(),
  hasOrders: z.enum(['true', 'false']).optional(),
  demo: z.enum(['true', 'false']).optional(),
  sort: z.enum(['newest', 'spend', 'orders']).default('newest'),
});

customersRouter.get('/', requirePermission('customers.view'), validateQuery(listSchema), async (req, res) => {
  const q = (req as unknown as { validatedQuery: z.infer<typeof listSchema> }).validatedQuery;
  const where: Prisma.CustomerWhereInput = {};
  if (q.q) {
    where.OR = [
      { name: { contains: q.q, mode: 'insensitive' } },
      { phone: { contains: q.q } },
      { email: { contains: q.q, mode: 'insensitive' } },
    ];
  }
  if (q.hasOrders === 'true') where.orders = { some: {} };
  if (q.hasOrders === 'false') where.orders = { none: {} };
  if (q.demo === 'true') where.isDemo = true;
  if (q.demo === 'false') where.isDemo = false;

  const customers = await prisma.customer.findMany({
    where,
    include: {
      _count: { select: { orders: true, wishlist: true } },
      orders: {
        select: { total: true, status: true, placedAt: true },
        orderBy: { placedAt: 'desc' },
        take: 200, // enough for stats of small/medium stores
      },
    },
    orderBy: q.sort === 'spend' ? { lastOrderAt: 'desc' } : q.sort === 'orders' ? { lastOrderAt: 'desc' } : { createdAt: 'desc' },
    skip: (q.page - 1) * q.limit,
    take: q.limit,
  });

  const total = await prisma.customer.count({ where });

  const items = customers.map((c) => {
    const validOrders = c.orders.filter((o) => !['CANCELLED', 'RETURNED', 'FAILED_DELIVERY'].includes(o.status));
    const totalSpent = validOrders.reduce((a, o) => a + Number(o.total), 0);
    const cancelled = c.orders.filter((o) => ['CANCELLED', 'RETURNED', 'FAILED_DELIVERY'].includes(o.status)).length;
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      isDemo: c.isDemo,
      notes: c.notes,
      orderCount: c.orders.length,
      totalSpent: Math.round(totalSpent * 100) / 100,
      cancelledCount: cancelled,
      lastOrderAt: c.orders[0]?.placedAt.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
    };
  });

  res.json({
    success: true,
    data: { items, pagination: { page: q.page, limit: q.limit, total, pages: Math.max(1, Math.ceil(total / q.limit)) } },
  });
});

customersRouter.get('/export', requirePermission('customers.export'), async (_req, res) => {
  const customers = await prisma.customer.findMany({
    include: { orders: { select: { total: true, status: true, placedAt: true } } },
    orderBy: { createdAt: 'desc' },
    take: 10000,
  });
  csvDownload(
    res,
    `customers-${new Date().toISOString().slice(0, 10)}.csv`,
    customers.map((c) => ({
      name: c.name, phone: c.phone, email: c.email || '',
      orders: c.orders.length,
      total_spent: c.orders.filter((o) => !['CANCELLED', 'RETURNED', 'FAILED_DELIVERY'].includes(o.status)).reduce((a, o) => a + Number(o.total), 0),
      registered: c.createdAt.toISOString(), last_order: c.orders[0]?.placedAt.toISOString() || '',
    }))
  );
});

customersRouter.get('/:id', requirePermission('customers.view'), async (req, res) => {
  const id = Number(req.params.id);
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      addresses: true,
      orders: {
        include: { items: true },
        orderBy: { placedAt: 'desc' },
        take: 50,
      },
    },
  });
  if (!customer) throw AppError.notFound('Customer not found');
  const stats = {
    totalOrders: customer.orders.length,
    totalSpent: Math.round(customer.orders.filter((o) => !['CANCELLED', 'RETURNED', 'FAILED_DELIVERY'].includes(o.status)).reduce((a, o) => a + Number(o.total), 0) * 100) / 100,
    cancelledOrders: customer.orders.filter((o) => ['CANCELLED', 'RETURNED', 'FAILED_DELIVERY'].includes(o.status)).length,
    failedDeliveries: customer.orders.filter((o) => o.status === 'FAILED_DELIVERY').length,
    codOrders: customer.orders.filter((o) => Number(o.codFee) > 0 || Number(o.total) > 0).length,
  };
  res.json({
    success: true,
    data: {
      customer: { id: customer.id, name: customer.name, phone: customer.phone, email: customer.email, notes: customer.notes, isDemo: customer.isDemo, createdAt: customer.createdAt, addresses: customer.addresses },
      stats,
      orders: customer.orders.map((o) => ({
        id: o.id, orderNumber: o.orderNumber, total: Number(o.total), status: o.status,
        emirate: emirateName(o.emirate), placedAt: o.placedAt.toISOString(),
        itemCount: o.items.reduce((a, i) => a + i.quantity, 0),
      })),
    },
  });
});

customersRouter.patch('/:id', requirePermission('customers.update'), async (req, res) => {
  const { notes, name, email } = z.object({
    notes: z.string().max(2000).optional(),
    name: z.string().min(2).max(80).optional(),
    email: z.string().email().optional().nullable(),
  }).parse(req.body);
  const id = Number(req.params.id);
  await prisma.customer.update({ where: { id }, data: { ...(notes !== undefined ? { notes: notes || null } : {}), ...(name !== undefined ? { name } : {}), ...(email !== undefined ? { email } : {}) } });
  await audit({ adminId: res.locals.admin.id, adminName: res.locals.admin.name, action: 'CUSTOMER_UPDATED', entityType: 'Customer', entityId: String(id), ip: clientIp(req) });
  res.json({ success: true, data: { message: 'Customer updated' } });
});
