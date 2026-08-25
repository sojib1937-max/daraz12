import rateLimit from 'express-rate-limit';
import { config } from '../config';
import { AppError } from './errors';

/** Standard JSON 429 body so the frontend can handle it consistently. */
function handler(_req: unknown, res: { status: (n: number) => { json: (o: unknown) => void } }) {
  res.status(429).json({
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' },
  });
}

export const globalLimiter = rateLimit({
  windowMs: config.rateLimit.globalWindowMs,
  limit: config.rateLimit.globalMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});

/** Login / password-reset endpoints: aggressive limits + lockout messages. */
export const authLimiter = rateLimit({
  windowMs: config.rateLimit.authWindowMs,
  limit: config.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (_req, _res, next) =>
    next(AppError.tooMany('Too many login attempts. Please wait 15 minutes and try again.')),
});

/** Order placement: prevents bulk ordering abuse. */
export const orderLimiter = rateLimit({
  windowMs: config.rateLimit.orderWindowMs,
  limit: config.rateLimit.orderMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) =>
    next(AppError.tooMany('Too many orders from this device. Please contact support if this is a mistake.')),
});

/** Contact/newsletter forms. */
export const formLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});
