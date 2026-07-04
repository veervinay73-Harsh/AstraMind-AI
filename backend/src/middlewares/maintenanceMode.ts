import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../utils/apiResponse';

export const maintenanceModeMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const isMaintenance = process.env.MAINTENANCE_MODE === 'true';
  
  // Allow health checks even in maintenance mode so container health probes don't crash
  const isHealthRoute = req.originalUrl === '/health' || req.url === '/health';

  if (isMaintenance && !isHealthRoute) {
    res.setHeader('Retry-After', '3600'); // Suggest retry in 1 hour
    ApiResponse.error(
      res,
      'The service is currently undergoing scheduled maintenance. Please try again later.',
      503,
      'SERVICE_UNAVAILABLE'
    );
    return;
  }

  next();
};
