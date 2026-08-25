// Admin authentication: login (with optional TOTP 2FA), logout, me,
// password reset, session revocation.
import { Router } from 'express';
import { z } from 'zod';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { prisma } from '../../lib/prisma';
import { verifyPassword, hashPassword, generateToken, hashToken } from '../../lib/security';
import { AppError } from '../../lib/errors';
import { authLimiter } from '../../lib/rateLimit';
import { validateBody } from '../../middleware/validate';
import { setAdminSessionCookie, clearAdminSessionCookie, requireAdmin, getAdminSessionToken } from '../../middleware/adminAuth';
import { audit } from '../../lib/audit';
import { clientIp } from '../../lib/analytics';
import { config } from '../../config';
import { sendEmail } from '../../lib/notifications';

export const adminAuthRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  totpCode: z.string().max(10).optional().or(z.literal('')),
  remember: z.boolean().optional(),
});

adminAuthRouter.post('/login', authLimiter, validateBody(loginSchema), async (req, res) => {
  const { email, password, totpCode } = req.body;
  const admin = await prisma.adminUser.findUnique({
    where: { email: email.toLowerCase().trim() },
  });
  // Identical error whether account missing or password wrong (no enumeration).
  if (!admin || !admin.isActive || admin.deletedAt) {
    throw AppError.unauthorized('Invalid email or password');
  }
  const ok = await verifyPassword(password, admin.passwordHash);
  if (!ok) throw AppError.unauthorized('Invalid email or password');

  if (admin.totpEnabled) {
    if (!totpCode) {
      return res.json({ success: true, data: { requiresTotp: true, message: 'Enter your authenticator code' } });
    }
    const valid = speakeasy.totp.verify({
      secret: admin.totpSecret || '',
      encoding: 'base32',
      token: totpCode.replace(/\s/g, ''),
      window: 1,
    });
    if (!valid) throw AppError.unauthorized('Invalid authenticator code');
  }

  const token = generateToken();
  const session = await prisma.adminSession.create({
    data: {
      adminId: admin.id,
      tokenHash: hashToken(token),
      ip: clientIp(req),
      userAgent: req.headers['user-agent']?.slice(0, 200),
      expiresAt: new Date(Date.now() + config.adminSessionDays * 24 * 3600 * 1000),
    },
  });
  setAdminSessionCookie(res, token);
  await prisma.adminUser.update({
    where: { id: admin.id },
    data: { lastLoginAt: new Date(), lastLoginIp: clientIp(req) },
  });
  await audit({
    adminId: admin.id,
    adminName: admin.name,
    action: 'ADMIN_LOGIN',
    entityType: 'AdminUser',
    entityId: String(admin.id),
    ip: clientIp(req),
  });
  res.json({
    success: true,
    data: {
      admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role, mustChangePassword: admin.mustChangePassword, totpEnabled: admin.totpEnabled },
      sessionId: session.id,
      token, // header-auth mode (works where cookies are blocked)
      demoMode: config.demoMode,
    },
  });
});

adminAuthRouter.post('/logout', async (req, res) => {
  const token = getAdminSessionToken(req);
  if (token) {
    await prisma.adminSession.updateMany({
      where: { tokenHash: hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  clearAdminSessionCookie(res);
  res.json({ success: true, data: null });
});

adminAuthRouter.get('/me', requireAdmin, async (_req, res) => {
  const admin = res.locals.admin;
  res.json({
    success: true,
    data: {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      totpEnabled: admin.totpEnabled,
      mustChangePassword: admin.mustChangePassword,
      lastLoginAt: admin.lastLoginAt,
      demoMode: config.demoMode,
    },
  });
});

// ---- 2FA (TOTP) ----
adminAuthRouter.post('/2fa/enable', requireAdmin, async (req, res) => {
  const admin = res.locals.admin;
  if (admin.role !== 'SUPER_ADMIN' && admin.role !== 'ADMIN') {
    throw AppError.forbidden('Only admins can enable 2FA');
  }
  const secret = speakeasy.generateSecret({ name: `DesertCart Admin (${admin.email})`, length: 20 });
  await prisma.adminUser.update({ where: { id: admin.id }, data: { totpSecret: secret.base32 } });
  const otpauth = secret.otpauth_url || '';
  const qr = await QRCode.toDataURL(otpauth);
  res.json({ success: true, data: { secret: secret.base32, qr } });
});

adminAuthRouter.post('/2fa/verify', requireAdmin, async (req, res) => {
  const admin = res.locals.admin;
  const { code } = z.object({ code: z.string().min(6).max(10) }).parse(req.body);
  if (!admin.totpSecret) throw AppError.badRequest('No 2FA secret pending');
  const valid = speakeasy.totp.verify({ secret: admin.totpSecret, encoding: 'base32', token: code.replace(/\s/g, ''), window: 1 });
  if (!valid) throw AppError.badRequest('Invalid code');
  await prisma.adminUser.update({ where: { id: admin.id }, data: { totpEnabled: true } });
  await audit({ adminId: admin.id, adminName: admin.name, action: 'ADMIN_2FA_ENABLED', entityType: 'AdminUser', entityId: String(admin.id), ip: clientIp(req) });
  res.json({ success: true, data: { message: '2FA enabled' } });
});

adminAuthRouter.post('/2fa/disable', requireAdmin, async (req, res) => {
  const admin = res.locals.admin;
  const { code, password } = z.object({ code: z.string().min(6).max(10), password: z.string().min(1) }).parse(req.body);
  const ok = await verifyPassword(password, admin.passwordHash);
  if (!ok) throw AppError.unauthorized('Password is incorrect');
  const valid = speakeasy.totp.verify({ secret: admin.totpSecret || '', encoding: 'base32', token: code.replace(/\s/g, ''), window: 1 });
  if (!valid) throw AppError.badRequest('Invalid authenticator code');
  await prisma.adminUser.update({ where: { id: admin.id }, data: { totpEnabled: false, totpSecret: null } });
  await audit({ adminId: admin.id, adminName: admin.name, action: 'ADMIN_2FA_DISABLED', entityType: 'AdminUser', entityId: String(admin.id), ip: clientIp(req) });
  res.json({ success: true, data: { message: '2FA disabled' } });
});

// ---- Password reset (admin) ----
adminAuthRouter.post('/forgot-password', authLimiter, async (req, res) => {
  const { email } = z.object({ email: z.string().email() }).parse(req.body);
  const admin = await prisma.adminUser.findUnique({ where: { email: email.toLowerCase().trim() } });
  // Always same response — never reveal whether an account exists.
  if (admin && admin.isActive && !admin.deletedAt) {
    const token = generateToken(24);
    await prisma.passwordResetToken.create({
      data: {
        tokenHash: hashToken(token),
        kind: 'ADMIN',
        entityId: admin.id,
        expiresAt: new Date(Date.now() + config.resetTokenMinutes * 60 * 1000),
      },
    });
    const link = `${config.appUrl}${config.adminBasePath}/reset-password?token=${token}`;
    await sendEmail({
      to: admin.email,
      subject: 'Reset your DesertCart admin password',
      text: `Hello ${admin.name},\n\nUse this link to reset your admin password (valid ${config.resetTokenMinutes} minutes):\n${link}\n\nIf you did not request this, ignore this email.`,
    });
  }
  res.json({
    success: true,
    data: { message: 'If an account exists for this email, a reset link has been sent.' },
  });
});

adminAuthRouter.post('/reset-password', authLimiter, async (req, res) => {
  const { token, password } = z.object({ token: z.string().min(20), password: z.string().min(8).max(100) }).parse(req.body);
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.kind !== 'ADMIN' || record.usedAt || record.expiresAt < new Date()) {
    throw AppError.badRequest('This reset link is invalid or has expired.');
  }
  const admin = await prisma.adminUser.findUnique({ where: { id: record.entityId } });
  if (!admin) throw AppError.badRequest('This reset link is invalid or has expired.');
  await prisma.$transaction([
    prisma.adminUser.update({ where: { id: admin.id }, data: { passwordHash: await hashPassword(password), mustChangePassword: false } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.adminSession.updateMany({ where: { adminId: admin.id, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
  res.json({ success: true, data: { message: 'Password updated. Please sign in.' } });
});

// ---- Change own password (authenticated) ----
adminAuthRouter.post('/change-password', requireAdmin, async (req, res) => {
  const admin = res.locals.admin;
  const { currentPassword, newPassword } = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8).max(100) }).parse(req.body);
  const ok = await verifyPassword(currentPassword, admin.passwordHash);
  if (!ok) throw AppError.badRequest('Current password is incorrect');
  await prisma.adminUser.update({
    where: { id: admin.id },
    data: { passwordHash: await hashPassword(newPassword), mustChangePassword: false },
  });
  await audit({ adminId: admin.id, adminName: admin.name, action: 'ADMIN_PASSWORD_CHANGED', entityType: 'AdminUser', entityId: String(admin.id), ip: clientIp(req) });
  res.json({ success: true, data: { message: 'Password updated' } });
});
