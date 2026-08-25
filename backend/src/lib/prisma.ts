import { PrismaClient } from '@prisma/client';

// Single shared Prisma client instance.
// In production this is also safe: Prisma pools connections internally.
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

export default prisma;
