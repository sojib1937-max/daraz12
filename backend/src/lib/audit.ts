// Audit log helper — records important admin actions.
import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

export async function audit(input: {
  adminId?: number;
  adminName?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  details?: Prisma.InputJsonValue;
  ip?: string;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        adminId: input.adminId,
        adminName: input.adminName,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        details: (input.details ?? {}) as Prisma.InputJsonValue,
        ip: input.ip,
      },
    });
  } catch (err) {
    console.error('audit log failed', (err as Error).message);
  }
}
