// In-app analytics events recorder (visitors, product views, add-to-cart,
// checkout started, orders, searches). Google Analytics / Meta Pixel IDs are
// injected by the frontend from settings — this module is the in-house layer.
import { AnalyticsEventType, Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { config } from '../config';

export async function recordEvent(input: {
  type: AnalyticsEventType;
  productId?: number;
  sessionId?: string;
  ip?: string;
  meta?: Prisma.InputJsonValue;
}) {
  try {
    await prisma.analyticsEvent.create({
      data: {
        type: input.type,
        productId: input.productId,
        sessionId: input.sessionId,
        ip: input.ip,
        meta: (input.meta ?? {}) as Prisma.InputJsonValue,
        isDemo: config.demoMode,
      },
    });
  } catch (err) {
    // Analytics recording must never break the request.
    console.error('analytics record failed', (err as Error).message);
  }
}

export function clientIp(req: { ip?: string; headers?: Record<string, string | string[] | undefined> }): string {
  const fwd = req.headers?.['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  return req.ip || '';
}
