import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodSchema } from 'zod';
import { ValidationError } from '../utils/customErrors';

export const validateRequest = (schema: ZodSchema) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorDetails = error.issues.map((issue) => ({
          field: issue.path.slice(1).join('.') || 'root', // removes 'body'/'query' prefix if present
          message: issue.message,
          rule: issue.code
        }));
        next(new ValidationError('Request validation failed', errorDetails));
        return;
      }
      next(error);
    }
  };
};
