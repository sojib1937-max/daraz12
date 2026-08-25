// Zod validation middleware.
import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';

export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.errors.map((e) => ({ path: e.path.join('.'), message: e.message }));
      return next(
        Object.assign(new Error('VALIDATION_ERROR'), {
          status: 422,
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details,
        })
      );
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const details = result.error.errors.map((e) => ({ path: e.path.join('.'), message: e.message }));
      return next(
        Object.assign(new Error('VALIDATION_ERROR'), {
          status: 422,
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details,
        })
      );
    }
    // Express 5 req.query is a getter — store the parsed result on the request.
    (req as Request & { validatedQuery?: unknown }).validatedQuery = result.data;
    next();
  };
}
