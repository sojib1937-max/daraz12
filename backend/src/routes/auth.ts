// Customer auth: register, login, logout, me, password reset.
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { hashPassword, verifyPassword, generateToken, hashToken } from '../lib/security';
import { AppError } from '../lib/errors';
import { authLimiter } from '../lib/rateLimit';
import { validateBody } from '../middleware/validate';
import { loadCustomer, setCustomerSessionCookie, clearCustomerSessionCookie, getCustomerSessionToken } from '../middleware/auth';
import { normalizeUaePhone } from '../lib/helpers';
import { sendEmail } from '../lib/notifications';
import { config } from '../config';
import { clientIp } from '../lib/analytics';

export const authRouter = Router();

authRouter.use(loadCustomer);

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(80),
  phone: z.string().min(8, 'Enter a valid UAE mobile number').max(16),
  email: z.string().email('Enter a valid email').optional().or(z.literal('')),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
});

authRouter.post('/register', authLimiter, validateBody(registerSchema), async (req, res) => {
  const { name, phone, email, password } = req.body;
  const normalized = normalizeUaePhone(phone);
  if (!normalized) throw AppError.badRequest('Enter a valid UAE mobile number (05XXXXXXXX or +9715XXXXXXXX)');

  const exists = await prisma.customer.findUnique({ where: { phone: normalized } });
  if (exists) throw AppError.conflict('An account with this phone number already exists. Please sign in.');

  const customer = await prisma.customer.create({
    data: {
      name: name.trim(),
      phone: normalized,
      email: email?.trim() || null,
      passwordHash: await hashPassword(password),
      isVerified: true,
    },
  });

  const token = generateToken();
  await prisma.customerSession.create({
    data: {
      customerId: customer.id,
      tokenHash: hashToken(token),
      ip: clientIp(req),
      userAgent: req.headers['user-agent']?.slice(0, 200),
      expiresAt: new Date(Date.now() + config.customerSessionDays * 24 * 3600 * 1000),
    },
  });
  setCustomerSessionCookie(res, token);

  res.json({ success: true, data: { id: customer.id, name: customer.name, phone: customer.phone, email: customer.email, token } });
});

const loginSchema = z.object({
  phone: z.string().min(8).max(16),
  password: z.string().min(1),
});

authRouter.post('/login', authLimiter, validateBody(loginSchema), async (req, res) => {
  const normalized = normalizeUaePhone(req.body.phone);
  if (!normalized) throw AppError.badRequest('Enter a valid UAE mobile number');

  const customer = await prisma.customer.findUnique({ where: { phone: normalized } });
  // Same error whether account missing or password wrong — no user enumeration.
  if (!customer || !customer.passwordHash) {
    throw AppError.unauthorized('Invalid phone number or password');
  }
  const ok = await verifyPassword(req.body.password, customer.passwordHash);
  if (!ok) throw AppError.unauthorized('Invalid phone number or password');

  const token = generateToken();
  await prisma.customerSession.create({
    data: {
      customerId: customer.id,
      tokenHash: hashToken(token),
      ip: clientIp(req),
      userAgent: req.headers['user-agent']?.slice(0, 200),
      expiresAt: new Date(Date.now() + config.customerSessionDays * 24 * 3600 * 1000),
    },
  });
  setCustomerSessionCookie(res, token);

  res.json({
    success: true,
    data: { id: customer.id, name: customer.name, phone: customer.phone, email: customer.email, token },
  });
});

authRouter.post('/logout', async (req, res) => {
  const token = getCustomerSessionToken(req);
  if (token) {
    await prisma.customerSession.updateMany({
      where: { tokenHash: hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  clearCustomerSessionCookie(res);
  res.json({ success: true, data: null });
});

authRouter.get('/me', async (_req, res) => {
  const customer = res.locals.customer;
  if (!customer) return res.json({ success: true, data: null });
  const [orderCount, totalSpent] = await Promise.all([
    prisma.order.count({ where: { customerId: customer.id, status: { notIn: ['CANCELLED', 'RETURNED'] } } }),
    prisma.order.aggregate({
      where: { customerId: customer.id, status: { notIn: ['CANCELLED', 'RETURNED'] } },
      _sum: { total: true },
    }),
  ]);
  res.json({
    success: true,
    data: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      createdAt: customer.createdAt,
      orderCount,
      totalSpent: Number(totalSpent._sum.total || 0),
    },
  });
});

// ---- Password reset (customer) ----
const forgotSchema = z.object({ phone: z.string().min(8).max(16) });

authRouter.post('/forgot-password', authLimiter, validateBody(forgotSchema), async (req, res) => {
  const normalized = normalizeUaePhone(req.body.phone);
  const customer = normalized ? await prisma.customer.findUnique({ where: { phone: normalized } }) : null;
  // Always respond the same — no account enumeration.
  if (customer && customer.email) {
    const token = generateToken(24);
    await prisma.passwordResetToken.create({
      data: {
        tokenHash: hashToken(token),
        kind: 'CUSTOMER',
        entityId: customer.id,
        expiresAt: new Date(Date.now() + config.resetTokenMinutes * 60 * 1000),
      },
    });
    const link = `${config.appUrl}/reset-password?token=${token}&type=customer`;
    await sendEmail({
      to: customer.email,
      subject: 'Reset your DesertCart password',
      text: `Hello ${customer.name},\n\nUse this link to reset your password (valid ${config.resetTokenMinutes} minutes):\n${link}\n\nIf you did not request this, you can ignore this email.`,
    });
  }
  res.json({
    success: true,
    data: {
      message: customer?.email
        ? 'If an account exists for this number, a reset link has been sent to the registered email.'
        : 'If an account exists for this number, a reset link will be sent to the registered email.',
    },
  });
});

const resetSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(8).max(100),
});

authRouter.post('/reset-password', authLimiter, validateBody(resetSchema), async (req, res) => {
  const { token, password } = req.body;
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.kind !== 'CUSTOMER' || record.usedAt || record.expiresAt < new Date()) {
    throw AppError.badRequest('This reset link is invalid or has expired. Request a new one.');
  }
  const customer = await prisma.customer.findUnique({ where: { id: record.entityId } });
  if (!customer) throw AppError.badRequest('This reset link is invalid or has expired.');
  await prisma.$transaction([
    prisma.customer.update({ where: { id: customer.id }, data: { passwordHash: await hashPassword(password) } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.customerSession.updateMany({ where: { customerId: customer.id, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
  res.json({ success: true, data: { message: 'Password updated. Please sign in with your new password.' } });
});
