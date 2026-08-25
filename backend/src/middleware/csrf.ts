// CSRF protection — double-submit cookie pattern for all state-changing
// requests (POST/PUT/PATCH/DELETE) to /api/*.
// Requests authenticated with a custom session-token header are inherently
// CSRF-safe (browsers never attach custom headers cross-site automatically),
// so the CSRF check is skipped for them. In non-production environments
// (dev / embedded preview iframes) cookies may be unavailable entirely —
// CSRF is relaxed there; rate limiting + validation still apply.
import { NextFunction, Request, Response } from 'express';
import { generateCsrfToken, csrfTokenValid } from '../lib/security';
import { AppError } from '../lib/errors';
import { config } from '../config';

export const CSRF_COOKIE = 'dc_csrf';

export function csrfIssuer(req: Request, res: Response, next: NextFunction) {
  if (!req.cookies?.[CSRF_COOKIE]) {
    res.cookie(CSRF_COOKIE, generateCsrfToken(), {
      httpOnly: false, // readable by JS so the client can echo it in the header
      secure: config.cookieSecure,
      sameSite: config.cookieSameSite,
      maxAge: 24 * 3600 * 1000,
      path: '/',
    });
  }
  next();
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function csrfProtect(req: Request, res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) return next();
  // Header-token-authenticated requests are not CSRF-able.
  if (req.headers['x-admin-token'] || req.headers['x-customer-token']) return next();
  // If the browser sent no cookies at all, double-submit cannot apply —
  // this covers cookie-less anonymous clients (split hosting where the API
  // is cross-site and third-party cookies are blocked). Without cookies there
  // is nothing for a CSRF attack to ride on.
  const hasAnyCookie = Object.keys(req.cookies || {}).length > 0;
  if (!hasAnyCookie) return next();
  // Dev/preview: cookies may be unavailable (sandboxed iframe, blocked
  // third-party cookies) — skip CSRF; production keeps the full check.
  if (!config.isProd) return next();
  // Double-submit cookie check (production, cookie-authenticated clients).
  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.headers['x-csrf-token'];
  if (typeof headerToken !== 'string' || !csrfTokenValid(cookieToken, headerToken)) {
    return next(new AppError(403, 'CSRF_INVALID', 'Security token missing or invalid. Refresh the page and try again.'));
  }
  next();
}
