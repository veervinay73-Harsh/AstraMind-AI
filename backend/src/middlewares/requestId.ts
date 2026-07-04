import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
  req.id = requestId;
  res.setHeader('x-request-id', requestId);
  next();
};
