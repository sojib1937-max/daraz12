// Admin authentication + RBAC authorization middleware.
// Sessions are stored server-side (AdminSession) so they can be revoked,
// audited, and expire — not just hidden in the frontend.
// The session token can be delivered via httpOnly cookie OR the
// X-Admin-Token header (needed where third-party cookies are blocked).
import { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { hashToken } from '../lib/security';
import { AppError } from '../lib/errors';
import { hasPermission } from '../lib/rbac';
import { config } from '../config';

export const ADMIN_COOKIE = 'dc_admin_session';

export function getAdminSessionToken(req: Request): string | null {
  const fromCookie = req.cookies?.[ADMIN_COOKIE];
  if (typeof fromCookie === 'string' && fromCookie.length >= 32) return fromCookie;
  const fromHeader = req.headers['x-admin-token'];
  if (typeof fromHeader === 'string' && fromHeader.length >= 32) return fromHeader;
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    const t = auth.slice(7).trim();
    if (t.length >= 32) return t;
  }
  return null;
}

export function setAdminSessionCookie(res: Response, token: string) {
  res.cookie(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: config.cookieSameSite,
    maxAge: config.adminSessionDays * 24 * 3600 * 1000,
    // Path must be "/" — the admin UI lives at ADMIN_BASE_PATH but the admin
    // API lives at /api/admin/* and both must receive the cookie.
    path: '/',
  });
}

export function clearAdminSessionCookie(res: Response) {
  res.clearCookie(ADMIN_COOKIE, { path: '/' });
}

/** Verifies the admin session token (cookie or header). Sets res.locals.admin on success. */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const token = getAdminSessionToken(req);
    if (!token) {
      return next(AppError.unauthorized('Admin authentication required'));
    }
    const session = await prisma.adminSession.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { admin: true },
    });
    if (!session || session.expiresAt <= new Date() || session.revokedAt || !session.admin || !session.admin.isActive) {
      return next(AppError.unauthorized('Session expired. Please sign in again.'));
    }
    if (session.admin.deletedAt) {
      return next(AppError.forbidden('Account no longer active'));
    }
    res.locals.admin = session.admin;
    res.locals.adminSession = session;
    // sliding touch
    if (Date.now() - session.lastSeenAt.getTime() > 5 * 60 * 1000) {
      prisma.adminSession
        .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
        .catch(() => undefined);
    }
    next();
  } catch (err) {
    next(err);
  }
}

/** RBAC gate: requireAdmin must run first. */
export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const admin = res.locals.admin;
    if (!admin) return next(AppError.unauthorized());
    if (!hasPermission(admin.role, permission)) {
      return next(AppError.forbidden());
    }
    next();
  };
}

/** Any authenticated admin (no specific permission). */
export function anyAdmin(req: Request, res: Response, next: NextFunction) {
  if (!res.locals.admin) return next(AppError.unauthorized());
  next();
}
