import { Request, Response, NextFunction } from 'express';
import { NotFoundError } from '../utils/customErrors';

export const notFoundMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  next(new NotFoundError(`Resource not found - ${req.method} ${req.originalUrl || req.url}`));
};
