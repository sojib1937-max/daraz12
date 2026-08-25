// Central error types + helpers. The error handler maps these to consistent
// API responses and NEVER leaks stack traces / DB errors to clients.
import { ZodError } from 'zod';
import { logger } from './logger';

export class AppError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: unknown) {
    return new AppError(400, 'BAD_REQUEST', message, details);
  }
  static unauthorized(message = 'Authentication required') {
    return new AppError(401, 'UNAUTHORIZED', message);
  }
  static forbidden(message = 'You do not have permission to perform this action') {
    return new AppError(403, 'FORBIDDEN', message);
  }
  static notFound(message = 'Resource not found') {
    return new AppError(404, 'NOT_FOUND', message);
  }
  static conflict(message: string) {
    return new AppError(409, 'CONFLICT', message);
  }
  static tooMany(message = 'Too many requests, please slow down') {
    return new AppError(429, 'RATE_LIMITED', message);
  }
  static unprocessable(message: string, details?: unknown) {
    return new AppError(422, 'UNPROCESSABLE', message, details);
  }
}

export function notFoundHandler(_req: unknown, res: { status: (n: number) => { json: (o: unknown) => void } }) {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function errorHandler(err: any, req: any, res: any, _next: any) {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      success: false,
      error: { code: err.code, message: err.message, details: err.details },
    });
  }
  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({ path: e.path.join('.'), message: e.message }));
    return res.status(422).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid input data', details },
    });
  }
  // Multer errors
  if (err && err.name === 'MulterError') {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large' : 'Upload failed';
    return res.status(400).json({ success: false, error: { code: 'UPLOAD_ERROR', message: msg } });
  }
  // Prisma known errors (unique constraint etc.) — map to friendly messages, never raw.
  if (err && err.code === 'P2002') {
    return res.status(409).json({
      success: false,
      error: { code: 'DUPLICATE', message: 'A record with this value already exists' },
    });
  }
  if (err && err.code === 'P2025') {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Record not found' } });
  }
  // Errors raised by middleware with an explicit status/code (e.g. validateBody)
  if (err && typeof err.status === 'number' && err.status < 500 && typeof err.message === 'string') {
    return res.status(err.status).json({
      success: false,
      error: { code: err.code || 'ERROR', message: err.message, details: err.details },
    });
  }
  // Unknown — log server-side only.
  logger.error('Unhandled error', { message: err?.message, stack: err?.stack });
  return res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' },
  });
}

export function asyncHandler(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fn: (req: any, res: any, next: any) => Promise<any>
) {
  return (req: unknown, res: unknown, next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
