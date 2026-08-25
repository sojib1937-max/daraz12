// Admin audit log + notifications (SSE stream + list) + analytics + abandoned carts.
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { requirePermission } from '../../middleware/adminAuth';
import { subscribe } from '../../lib/sse';
import { dateRangeFromParam } from '../../lib/helpers';

// ---------------- Audit log ----------------
export const auditRouter = Router();

auditRouter.get('/', requirePermission('audit.view'), async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
  const q = String(req.query.q || '');
  const action = String(req.query.action || '');
  const where: Record<string, unknown> = {};
  if (q) {
    where.OR = [
      { adminName: { contains: q, mode: 'insensitive' } },
      { action: { contains: q, mode: 'insensitive' } },
      { entityType: { contains: q, mode: 'insensitive' } },
      { entityId: { contains: q } },
    ];
  }
  if (action) where.action = action;
  const [total, items] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: { admin: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);
  res.json({
    success: true,
    data: {
      items: items.map((a) => ({
        id: a.id, adminName: a.adminName || a.admin?.name || 'System', action: a.action,
        entityType: a.entityType, entityId: a.entityId, details: a.details, ip: a.ip,
        createdAt: a.createdAt.toISOString(),
      })),
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    },
  });
});

// ---------------- Notifications ----------------
export const notificationsRouter = Router();

notificationsRouter.get('/', requirePermission('notifications.view'), async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const [total, items] = await Promise.all([
    prisma.notification.count(),
    prisma.notification.findMany({ orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
  ]);
  const unread = await prisma.notification.count({ where: { isRead: false } });
  res.json({
    success: true,
    data: {
      items: items.map((n) => ({ id: n.id, type: n.type, title: n.title, body: n.body, data: n.data, isRead: n.isRead, createdAt: n.createdAt.toISOString() })),
      unread,
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    },
  });
});

notificationsRouter.post('/read', requirePermission('notifications.view'), async (req, res) => {
  const { ids } = z.object({ ids: z.array(z.number().int()).optional() }).parse(req.body || {});
  if (ids?.length) {
    await prisma.notification.updateMany({ where: { id: { in: ids } }, data: { isRead: true } });
  } else {
    await prisma.notification.updateMany({ data: { isRead: true } });
  }
  res.json({ success: true, data: { message: 'Marked as read' } });
});

notificationsRouter.get('/events', requirePermission('notifications.view'), (req, res) => {
  subscribe('admin', res, { adminId: res.locals.admin.id });
});

// ---------------- Analytics ----------------
export const analyticsRouter = Router();

analyticsRouter.get('/overview', requirePermission('analytics.view'), async (req, res) => {
  const { from, to } = dateRangeFromParam(req.query.range as string | undefined);
  const events = await prisma.analyticsEvent.groupBy({
    by: ['type'],
    where: { createdAt: { gte: from, lte: to } },
    _count: true,
  });
  const daily = await prisma.analyticsEvent.groupBy({
    by: ['type', 'createdAt'],
    where: { createdAt: { gte: from, lte: to } },
    _count: true,
  });
  // group by day
  const byDay = new Map<string, Record<string, number>>();
  for (const e of daily) {
    const key = e.createdAt.toISOString().slice(0, 10);
    const b = byDay.get(key) || {};
    b[e.type] = (b[e.type] || 0) + e._count;
    byDay.set(key, b);
  }
  res.json({
    success: true,
    data: {
      totals: Object.fromEntries(events.map((e) => [e.type, e._count])),
      byDay: [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, v]) => ({ date, ...v })),
    },
  });
});

analyticsRouter.get('/events', requirePermission('analytics.view'), async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
  const type = String(req.query.type || '');
  const where = type ? { type: type as never } : {};
  const [total, items] = await Promise.all([
    prisma.analyticsEvent.count({ where }),
    prisma.analyticsEvent.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
  ]);
  res.json({
    success: true,
    data: {
      items: items.map((e) => ({ id: e.id, type: e.type, productId: e.productId, sessionId: e.sessionId, meta: e.meta, isDemo: e.isDemo, createdAt: e.createdAt.toISOString() })),
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    },
  });
});

// ---------------- Abandoned carts ----------------
export const cartsRouter = Router();

cartsRouter.get('/abandoned', requirePermission('carts.view'), async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const since = new Date(Date.now() - 14 * 24 * 3600 * 1000);
  const [total, items] = await Promise.all([
    prisma.cartSession.count({ where: { updatedAt: { gte: since }, progress: { not: 'PLACED' } } }),
    prisma.cartSession.findMany({
      where: { updatedAt: { gte: since }, progress: { not: 'PLACED' } },
      include: { customer: { select: { id: true, name: true, phone: true } } },
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);
  res.json({
    success: true,
    data: {
      items: items.map((c) => {
        const cartItems = (c.items as { productId?: number; quantity?: number; title?: string; price?: number; image?: string }[]) || [];
        const value = cartItems.reduce((a, i) => a + (i.price || 0) * (i.quantity || 1), 0);
        return {
          id: c.id, customer: c.customer, progress: c.progress, itemCount: cartItems.reduce((a, i) => a + (i.quantity || 0), 0),
          value: Math.round(value * 100) / 100, firstItemTitle: cartItems[0]?.title || '',
          items: cartItems.slice(0, 20), updatedAt: c.updatedAt.toISOString(), createdAt: c.createdAt.toISOString(),
        };
      }),
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    },
  });
});
