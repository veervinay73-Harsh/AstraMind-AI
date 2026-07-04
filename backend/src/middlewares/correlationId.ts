import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export const correlationIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const correlationId = (req.headers['x-correlation-id'] as string) || crypto.randomUUID();
  req.correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);
  next();
};
