// Customer authentication middleware — opaque session token in httpOnly cookie
// AND/OR X-Customer-Token header (header mode works in environments where
// third-party cookies are blocked, e.g. embedded previews).
import { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { hashToken } from '../lib/security';
import { AppError } from '../lib/errors';
import { config } from '../config';

export const CUSTOMER_COOKIE = 'dc_customer_session';

export function getCustomerSessionToken(req: Request): string | null {
  const fromCookie = req.cookies?.[CUSTOMER_COOKIE];
  if (typeof fromCookie === 'string' && fromCookie.length >= 32) return fromCookie;
  const fromHeader = req.headers['x-customer-token'];
  if (typeof fromHeader === 'string' && fromHeader.length >= 32) return fromHeader;
  return null;
}

export function setCustomerSessionCookie(res: Response, token: string) {
  res.cookie(CUSTOMER_COOKIE, token, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: config.cookieSameSite,
    maxAge: config.customerSessionDays * 24 * 3600 * 1000,
    path: '/',
  });
}

export function clearCustomerSessionCookie(res: Response) {
  res.clearCookie(CUSTOMER_COOKIE, { path: '/' });
}

export async function loadCustomer(req: Request, res: Response, next: NextFunction) {
  const token = getCustomerSessionToken(req);
  if (!token) return next();
  const session = await prisma.customerSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { customer: true },
  });
  if (session && session.expiresAt > new Date() && !session.revokedAt && session.customer) {
    res.locals.customer = session.customer;
    // sliding expiration touch
    if (Date.now() - session.lastSeenAt.getTime() > 5 * 60 * 1000) {
      prisma.customerSession
        .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
        .catch(() => undefined);
    }
  }
  next();
}

export function requireCustomer(req: Request, res: Response, next: NextFunction) {
  if (!res.locals.customer) {
    return next(AppError.unauthorized('Please sign in to continue'));
  }
  next();
}

export function optionalCustomer(req: Request, res: Response, next: NextFunction) {
  next();
}
