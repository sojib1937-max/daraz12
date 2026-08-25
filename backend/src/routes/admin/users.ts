// Admin user management (SUPER_ADMIN only) + roles/permissions catalog.
import { Router } from 'express';
import { z } from 'zod';
import { AdminRole } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../lib/errors';
import { hashPassword, generateToken, hashToken } from '../../lib/security';
import { requirePermission } from '../../middleware/adminAuth';
import { audit } from '../../lib/audit';
import { clientIp } from '../../lib/analytics';
import { PERMISSIONS, ROLES, rolePermissions } from '../../lib/rbac';
import { sendEmail } from '../../lib/notifications';
import { config } from '../../config';

export const usersRouter = Router();

usersRouter.get('/roles', requirePermission('admin.manage'), (_req, res) => {
  res.json({
    success: true,
    data: {
      roles: ROLES.map((r) => ({ ...r, permissions: rolePermissions(r.value) })),
      permissions: Object.entries(PERMISSIONS).map(([key, p]) => ({ key, ...p })),
    },
  });
});

usersRouter.get('/', requirePermission('admin.manage'), async (_req, res) => {
  const users = await prisma.adminUser.findMany({
    where: { deletedAt: null },
    select: {
      id: true, email: true, name: true, role: true, isActive: true, totpEnabled: true,
      mustChangePassword: true, lastLoginAt: true, createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ success: true, data: users });
});

const userSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  role: z.nativeEnum(AdminRole),
  password: z.string().min(8).max(100).optional(),
  isActive: z.boolean().default(true),
});

usersRouter.post('/', requirePermission('admin.manage'), async (req, res) => {
  const data = userSchema.parse(req.body);
  const email = data.email.toLowerCase().trim();
  const exists = await prisma.adminUser.findUnique({ where: { email } });
  if (exists) throw AppError.conflict('An admin with this email already exists');

  const password = data.password || generateToken(10) + 'Aa1!';
  const user = await prisma.adminUser.create({
    data: {
      name: data.name.trim(),
      email,
      passwordHash: await hashPassword(password),
      role: data.role,
      isActive: data.isActive,
      mustChangePassword: !data.password, // auto-generated password must be changed
    },
  });

  if (!data.password) {
    const token = generateToken(24);
    await prisma.passwordResetToken.create({
      data: {
        tokenHash: hashToken(token),
        kind: 'ADMIN',
        entityId: user.id,
        expiresAt: new Date(Date.now() + 48 * 3600 * 1000),
      },
    });
    const link = `${config.appUrl}${config.adminBasePath}/reset-password?token=${token}`;
    await sendEmail({
      to: email,
      subject: 'Your DesertCart admin account',
      text: `Hello ${data.name},\n\nAn admin account has been created for you.\n\nSet your password using this secure link (valid 48 hours):\n${link}\n\nDo not share this link.`,
    });
  }

  await audit({ adminId: res.locals.admin.id, adminName: res.locals.admin.name, action: 'ADMIN_USER_CREATED', entityType: 'AdminUser', entityId: String(user.id), details: { email, role: data.role }, ip: clientIp(req) });
  res.status(201).json({ success: true, data: { id: user.id, email: user.email, name: user.name, role: user.role, passwordWasGenerated: !data.password } });
});

usersRouter.patch('/:id', requirePermission('admin.manage'), async (req, res) => {
  const id = Number(req.params.id);
  const data = userSchema.partial().parse(req.body);
  const target = await prisma.adminUser.findUnique({ where: { id } });
  if (!target || target.deletedAt) throw AppError.notFound('Admin not found');
  const me = res.locals.admin;
  if (target.id === me.id && data.role && data.role !== me.role) {
    throw AppError.forbidden('You cannot change your own role');
  }
  if (target.id === me.id && data.isActive === false) {
    throw AppError.forbidden('You cannot deactivate your own account');
  }
  const updateData: Record<string, unknown> = {};
  const d = data as Record<string, unknown>;
  for (const k of ['name', 'email', 'role', 'isActive']) {
    if (d[k] !== undefined) updateData[k] = k === 'email' ? String(d[k]).toLowerCase().trim() : d[k];
  }
  if (data.password) updateData.passwordHash = await hashPassword(data.password);
  await prisma.adminUser.update({ where: { id }, data: updateData as never });
  if (data.password) {
    await prisma.adminSession.updateMany({ where: { adminId: id, revokedAt: null }, data: { revokedAt: new Date() } });
  }
  await audit({ adminId: me.id, adminName: me.name, action: 'ADMIN_USER_UPDATED', entityType: 'AdminUser', entityId: String(id), details: { keys: Object.keys(data) }, ip: clientIp(req) });
  res.json({ success: true, data: { message: 'Admin updated' } });
});

usersRouter.delete('/:id', requirePermission('admin.manage'), async (req, res) => {
  const id = Number(req.params.id);
  const me = res.locals.admin;
  if (id === me.id) throw AppError.forbidden('You cannot delete your own account');
  const target = await prisma.adminUser.findUnique({ where: { id } });
  if (!target) throw AppError.notFound('Admin not found');
  await prisma.adminUser.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  await prisma.adminSession.updateMany({ where: { adminId: id, revokedAt: null }, data: { revokedAt: new Date() } });
  await audit({ adminId: me.id, adminName: me.name, action: 'ADMIN_USER_DELETED', entityType: 'AdminUser', entityId: String(id), details: { email: target.email }, ip: clientIp(req) });
  res.json({ success: true, data: { message: 'Admin deleted' } });
});
