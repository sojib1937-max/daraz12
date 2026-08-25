// Order fraud / duplicate detection.
// Flags (never auto-rejects) duplicate COD orders from the same phone with the
// same items within a configurable window. Admins review flagged orders.
import { prisma } from './prisma';
import { getSetting } from './settings';

export interface RiskFlag {
  type: 'DUPLICATE_ORDER' | 'HIGH_VALUE' | 'INVALID_PHONE' | 'SUSPICIOUS_PATTERN';
  reason: string;
  detail?: string;
}

export async function detectOrderRisks(input: {
  phone: string;
  items: { productId: number; quantity: number }[];
  total: number;
}): Promise<RiskFlag[]> {
  const flags: RiskFlag[] = [];

  const windowHours = Number(await getSetting('fraud.duplicateWindowHours')) || 6;
  const maxDuplicates = Number(await getSetting('fraud.duplicateMaxOrders')) || 2;
  const highValueThreshold = Number(await getSetting('fraud.flagHighValueOrdersAbove')) || 1000;

  // Same phone + identical item set within the window.
  const windowStart = new Date(Date.now() - windowHours * 3600 * 1000);
  const recent = await prisma.order.findMany({
    where: {
      customerPhone: input.phone,
      placedAt: { gte: windowStart },
      status: { notIn: ['CANCELLED', 'RETURNED', 'FAILED_DELIVERY'] },
    },
    include: { items: true },
    orderBy: { placedAt: 'desc' },
    take: 20,
  });

  if (recent.length >= maxDuplicates) {
    flags.push({
      type: 'SUSPICIOUS_PATTERN',
      reason: `This phone number has placed ${recent.length} recent order(s) within ${windowHours} hours`,
      detail: `Recent orders: ${recent.map((o) => o.orderNumber).join(', ')}`,
    });
  }

  const exactDup = recent.find((o) => {
    const sameQty = o.items.length === input.items.length;
    if (!sameQty) return false;
    const map = new Map(o.items.map((i) => [`${i.productId}:${i.quantity}`, true]));
    return input.items.every((i) => map.has(`${i.productId}:${i.quantity}`));
  });

  if (exactDup) {
    flags.push({
      type: 'DUPLICATE_ORDER',
      reason: `Identical order (same items & quantity) exists: ${exactDup.orderNumber}`,
      detail: `Placed ${timeAgoShort(exactDup.placedAt)}`,
    });
  }

  if (input.total >= highValueThreshold) {
    flags.push({
      type: 'HIGH_VALUE',
      reason: `Order total (AED ${input.total.toFixed(2)}) exceeds high-value threshold`,
    });
  }

  return flags;
}

function timeAgoShort(d: Date): string {
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 60) return `${mins} minutes ago`;
  return `${Math.floor(mins / 60)} hours ago`;
}
