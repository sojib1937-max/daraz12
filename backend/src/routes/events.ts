// SSE event stream for the storefront: real social-proof popups.
// Privacy: broadcasts are masked (no full name, phone, or address).
// DEMO_MODE: events are labelled "demo" — demo data never mixes with real data.
import { Router } from 'express';
import { subscribe } from '../lib/sse';
import { prisma } from '../lib/prisma';
import { getSetting } from '../lib/settings';
import { maskName, timeAgo } from '../lib/helpers';
import { config } from '../config';

export const eventsRouter = Router();

/**
 * Polling fallback for social-proof popups.
 * When the frontend is hosted separately from the API (e.g. Netlify → Render),
 * SSE streams may be buffered/blocked — the frontend polls this endpoint
 * instead. Same privacy rules as the SSE stream: masked, demo-labelled.
 */
eventsRouter.get('/sales/recent', async (_req, res) => {
  const enabled = (await getSetting('popups.salesEnabled')) !== false;
  if (!enabled) return res.json({ success: true, data: [] });

  const recentOrders = await prisma.order.findMany({
    where: { status: { notIn: ['CANCELLED', 'RETURNED', 'FAILED_DELIVERY'] } },
    include: { items: { take: 1 } },
    orderBy: { placedAt: 'desc' },
    take: 8,
  });

  const mask = (await getSetting('popups.salesMaskNames')) !== false;
  const items: unknown[] = [];

  for (const order of recentOrders) {
    const firstItem = order.items[0];
    if (!firstItem) continue;
    const demo = order.isDemo || config.demoMode;
    // Real orders always; demo orders only in DEMO_MODE (labelled).
    if (demo && !config.demoMode) continue;
    const ago = timeAgo(order.placedAt);
    let productSlug: string | undefined;
    if (firstItem.productId) {
      const p = await prisma.product.findUnique({ where: { id: firstItem.productId }, select: { slug: true } });
      productSlug = p?.slug;
    }
    items.push({
      id: order.id,
      orderNumber: order.orderNumber,
      productTitle: firstItem.productTitle,
      productImage: firstItem.imageUrl,
      productSlug,
      emirate: order.emirate,
      customerInitial: mask ? maskName(order.customerName) : null,
      timeAgoEn: ago.labelEn,
      timeAgoAr: ago.labelAr,
      demo,
    });
  }
  res.json({ success: true, data: items });
});

eventsRouter.get('/sales', async (req, res) => {
  const enabled = (await getSetting('popups.salesEnabled')) !== false;
  if (!enabled) {
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.end();
    return;
  }

  const cleanup = subscribe('public', res);

  // Replay recent real sales so the popup shows on page load (privacy-masked).
  try {
    const recentOrders = await prisma.order.findMany({
      where: { status: { notIn: ['CANCELLED', 'RETURNED', 'FAILED_DELIVERY'] } },
      include: { items: { take: 1 } },
      orderBy: { placedAt: 'desc' },
      take: 8,
    });

    const mask = (await getSetting('popups.salesMaskNames')) !== false;

    for (const order of recentOrders) {
      const firstItem = order.items[0];
      if (!firstItem) continue;
      const ago = timeAgo(order.placedAt);
      const payload = {
        id: order.id,
        orderNumber: order.orderNumber,
        productTitle: firstItem.productTitle,
        productImage: firstItem.imageUrl,
        productSlug: undefined as string | undefined,
        emirate: order.emirate,
        customerInitial: mask ? maskName(order.customerName) : null,
        timeAgoEn: ago.labelEn,
        timeAgoAr: ago.labelAr,
        demo: order.isDemo || config.demoMode,
      };
      // Resolve slug lazily (avoid heavy join on the replay query)
      if (firstItem.productId) {
        const p = await prisma.product.findUnique({ where: { id: firstItem.productId }, select: { slug: true } });
        payload.productSlug = p?.slug;
      }
      if (!payload.demo || config.demoMode) {
        // Real orders always emit (masked). Demo orders emit ONLY in DEMO_MODE,
        // where the UI shows a DEMO badge — demo events never mix with real data.
        res.write(`event: recent-sale\ndata: ${JSON.stringify(payload)}\n\n`);
      }
    }
  } catch {
    /* stream still works without replay */
  }

  req.on('close', cleanup);
});
