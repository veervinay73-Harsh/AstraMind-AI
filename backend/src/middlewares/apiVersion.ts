import { Request, Response, NextFunction } from 'express';

export const apiVersionMiddleware = (version: string = 'v1') => {
  return (_req: Request, res: Response, next: NextFunction): void => {
    res.setHeader('X-API-Version', version);
    next();
  };
};
