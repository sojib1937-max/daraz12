// Admin dashboard: KPI cards, revenue/orders charts, top products, low stock,
// recent orders, conversion stats.
import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { requirePermission } from '../../middleware/adminAuth';
import { dateRangeFromParam } from '../../lib/helpers';

export const dashboardRouter = Router();

dashboardRouter.get('/summary', requirePermission('dashboard.view'), async (req, res) => {
  const { from, to } = dateRangeFromParam(req.query.range as string | undefined);
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  const [
    todayOrders, todaySales, yesterdaySales, rangeOrders, rangeSales,
    pending, confirmed, delivered, cancelled,
    totalCustomers, totalProducts, lowStock, codRevenue, totalRevenue,
    visitors, productViews, addToCart, checkoutStarted,
    topProducts, recentOrders,
  ] = await Promise.all([
    prisma.order.count({ where: { placedAt: { gte: todayStart }, status: { notIn: ['CANCELLED', 'RETURNED', 'FAILED_DELIVERY'] } } }),
    prisma.order.aggregate({ where: { placedAt: { gte: todayStart }, status: { notIn: ['CANCELLED', 'RETURNED', 'FAILED_DELIVERY'] } }, _sum: { total: true } }),
    prisma.order.aggregate({ where: { placedAt: { gte: yesterdayStart, lt: todayStart }, status: { notIn: ['CANCELLED', 'RETURNED', 'FAILED_DELIVERY'] } }, _sum: { total: true } }),
    prisma.order.count({ where: { placedAt: { gte: from, lte: to } } }),
    prisma.order.aggregate({ where: { placedAt: { gte: from, lte: to }, status: { notIn: ['CANCELLED', 'RETURNED', 'FAILED_DELIVERY'] } }, _sum: { total: true } }),
    prisma.order.count({ where: { status: { in: ['NEW', 'CONFIRMED'] } } }),
    prisma.order.count({ where: { status: 'CONFIRMED' } }),
    prisma.order.count({ where: { status: 'DELIVERED' } }),
    prisma.order.count({ where: { status: 'CANCELLED' } }),
    prisma.customer.count(),
    prisma.product.count({ where: { deletedAt: null } }),
    prisma.product.count({ where: { deletedAt: null, stock: { lte: prisma.product.fields.lowStockThreshold } } }),
    prisma.order.aggregate({ where: { placedAt: { gte: from, lte: to }, status: 'COD_COLLECTED' }, _sum: { total: true } }),
    prisma.order.aggregate({ where: { placedAt: { gte: from, lte: to }, status: { notIn: ['CANCELLED', 'RETURNED', 'FAILED_DELIVERY'] } }, _sum: { total: true } }),
    prisma.analyticsEvent.count({ where: { type: 'PAGE_VIEW', createdAt: { gte: from, lte: to } } }),
    prisma.analyticsEvent.count({ where: { type: 'PRODUCT_VIEW', createdAt: { gte: from, lte: to } } }),
    prisma.analyticsEvent.count({ where: { type: 'ADD_TO_CART', createdAt: { gte: from, lte: to } } }),
    prisma.analyticsEvent.count({ where: { type: 'CHECKOUT_STARTED', createdAt: { gte: from, lte: to } } }),
    prisma.orderItem.groupBy({
      by: ['productId'],
      where: { order: { placedAt: { gte: from, lte: to }, status: { notIn: ['CANCELLED', 'RETURNED'] } } },
      _sum: { quantity: true, totalPrice: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 8,
    }),
    prisma.order.findMany({
      include: { items: true },
      orderBy: { placedAt: 'desc' },
      take: 8,
    }),
  ]);

  const topProductIds = topProducts.map((t) => t.productId).filter(Boolean);
  const topProductsFull = await prisma.product.findMany({
    where: { id: { in: topProductIds as number[] } },
    select: { id: true, title: true, slug: true, price: true, images: { take: 1 }, stock: true },
  });
  const topProductsMerged = topProducts.map((t) => {
    const p = topProductsFull.find((x) => x.id === t.productId);
    return {
      productId: t.productId,
      title: p?.title ?? 'Deleted product',
      slug: p?.slug ?? '',
      image: p?.images[0]?.url ?? '',
      stock: p?.stock ?? 0,
      quantity: t._sum.quantity || 0,
      revenue: Number(t._sum.totalPrice || 0),
    };
  });

  const todaySalesVal = Number(todaySales._sum.total || 0);
  const yesterdaySalesVal = Number(yesterdaySales._sum.total || 0);
  const rangeSalesVal = Number(rangeSales._sum.total || 0);

  res.json({
    success: true,
    data: {
      range: { from: from.toISOString(), to: to.toISOString() },
      cards: {
        todaySales: todaySalesVal,
        todayOrders,
        yesterdaySales: yesterdaySalesVal,
        salesChangePercent: yesterdaySalesVal > 0 ? Math.round(((todaySalesVal - yesterdaySalesVal) / yesterdaySalesVal) * 100) : null,
        pendingOrders: pending,
        confirmedOrders: confirmed,
        deliveredOrders: delivered,
        cancelledOrders: cancelled,
        totalCustomers,
        totalProducts,
        lowStockCount: lowStock,
        codRevenue: Number(codRevenue._sum.total || 0),
        totalRevenue: rangeSalesVal,
        profitEstimate: await profitEstimate(from, to),
      },
      funnel: {
        visitors: visitors + productViews, // page views counted as visits approximation
        productViews,
        addToCart,
        checkoutStarted,
        ordersPlaced: rangeOrders,
        delivered: delivered,
        conversionRate: visitors > 0 ? Math.round((rangeOrders / (visitors || 1)) * 10000) / 100 : 0,
        averageOrderValue: rangeOrders > 0 ? Math.round((rangeSalesVal / rangeOrders) * 100) / 100 : 0,
      },
      topProducts: topProductsMerged,
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: o.customerName,
        emirate: o.emirate,
        total: Number(o.total),
        status: o.status,
        isDemo: o.isDemo,
        placedAt: o.placedAt.toISOString(),
        itemCount: o.items.reduce((a, i) => a + i.quantity, 0),
      })),
    },
  });
});

async function profitEstimate(from: Date, to: Date): Promise<number> {
  const items = await prisma.orderItem.findMany({
    where: { order: { placedAt: { gte: from, lte: to }, status: { notIn: ['CANCELLED', 'RETURNED', 'FAILED_DELIVERY'] } } },
    include: { product: { select: { costPrice: true } } },
  });
  let profit = 0;
  for (const item of items) {
    if (item.product?.costPrice) {
      profit += (Number(item.unitPrice) - Number(item.product.costPrice)) * item.quantity;
    }
  }
  return Math.round(profit * 100) / 100;
}

// Revenue/orders time series for charts
dashboardRouter.get('/charts', requirePermission('dashboard.view'), async (req, res) => {
  const { from, to } = dateRangeFromParam(req.query.range as string | undefined);
  const days = Math.min(90, Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000) + 1));
  const granularity = days <= 31 ? 'day' : 'week';

  const orders = await prisma.order.findMany({
    where: { placedAt: { gte: from, lte: to }, status: { notIn: ['CANCELLED', 'RETURNED', 'FAILED_DELIVERY'] } },
    select: { placedAt: true, total: true, status: true },
  });

  const buckets = new Map<string, { revenue: number; orders: number }>();
  const start = new Date(from);
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const key = granularity === 'day' ? d.toISOString().slice(0, 10) : `${d.getFullYear()}-W${Math.ceil((d.getDate() + 1) / 7)}`;
    if (!buckets.has(key)) buckets.set(key, { revenue: 0, orders: 0 });
  }
  for (const o of orders) {
    const key = granularity === 'day' ? o.placedAt.toISOString().slice(0, 10) : `${o.placedAt.getFullYear()}-W${Math.ceil((o.placedAt.getDate() + 1) / 7)}`;
    const b = buckets.get(key) || { revenue: 0, orders: 0 };
    b.revenue += Number(o.total);
    b.orders += 1;
    buckets.set(key, b);
  }

  const series = [...buckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, v]) => ({ date, revenue: Math.round(v.revenue * 100) / 100, orders: v.orders }));

  // Orders by status
  const statusCounts = await prisma.order.groupBy({
    by: ['status'],
    where: { placedAt: { gte: from, lte: to } },
    _count: true,
  });

  res.json({
    success: true,
    data: {
      series,
      byStatus: statusCounts.map((s) => ({ status: s.status, count: s._count })),
    },
  });
});
