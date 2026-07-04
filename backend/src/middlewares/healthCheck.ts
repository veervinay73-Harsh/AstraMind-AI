import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../utils/apiResponse';

export const healthCheckMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  if (req.url === '/health' || req.originalUrl === '/health') {
    ApiResponse.success(res, {
      status: 'UP',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      service: 'AstraMind AI Backend Core'
    });
    return;
  }
  next();
};
