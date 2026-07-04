import { Request, Response, NextFunction } from 'express';

export const requestTimingMiddleware = (_req: Request, res: Response, next: NextFunction): void => {
  const start = process.hrtime();

  const originalWriteHead = res.writeHead;
  res.writeHead = function (statusCode: number, ...args: any[]): any {
    const diff = process.hrtime(start);
    const timeInMs = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2);
    res.setHeader('X-Response-Time', `${timeInMs}ms`);
    return (originalWriteHead as any).apply(this, [statusCode, ...args]);
  };

  next();
};
