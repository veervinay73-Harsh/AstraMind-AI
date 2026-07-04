import { Request, Response, NextFunction } from 'express';
import { BadRequestError } from '../utils/customErrors';

export const tenantIsolationMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  const hospitalId = req.headers['x-hospital-id'] as string;
  
  if (!hospitalId) {
    next(new BadRequestError('Tenant Identification Required. Please provide X-Hospital-ID header.'));
    return;
  }

  // Bind the isolated tenant context to the request object
  req.hospitalId = hospitalId;
  next();
};
