#!/usr/bin/env tsx
// Create an admin user from the CLI.
// Usage:
//   npx tsx scripts/create-admin.ts <email> <name> <ROLE> [password]
//   ROLE ∈ SUPER_ADMIN | ADMIN | MANAGER | ORDER_MANAGER | PRODUCT_MANAGER | VIEWER
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { config } from '../backend/src/config';

const prisma = new PrismaClient();

async function main() {
  const [email, name, role, passwordArg] = process.argv.slice(2);
  if (!email || !name || !role) {
    console.error('Usage: npx tsx scripts/create-admin.ts <email> <name> <ROLE> [password]');
    console.error('Roles:', ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ORDER_MANAGER', 'PRODUCT_MANAGER', 'VIEWER'].join(' | '));
    process.exit(1);
  }
  const validRoles = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ORDER_MANAGER', 'PRODUCT_MANAGER', 'VIEWER'];
  if (!validRoles.includes(role.toUpperCase())) {
    console.error(`Invalid role "${role}". Use one of: ${validRoles.join(', ')}`);
    process.exit(1);
  }
  const password = passwordArg || `${Math.random().toString(36).slice(2, 8)}Aa1!${Date.now().toString().slice(-3)}`;
  const hash = await bcrypt.hash(password, 12);
  await prisma.adminUser.upsert({
    where: { email: email.toLowerCase().trim() },
    create: {
      email: email.toLowerCase().trim(),
      name: name.trim(),
      passwordHash: hash,
      role: role.toUpperCase() as never,
      isActive: true,
      mustChangePassword: !passwordArg,
    },
    update: { name: name.trim(), role: role.toUpperCase() as never, isActive: true, deletedAt: null },
  });
  console.log(`✅ Admin ready: ${email} (${role.toUpperCase()})`);
  if (!passwordArg) console.log(`   Temporary password (must be changed on first login): ${password}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
