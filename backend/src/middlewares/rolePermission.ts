import { Request, Response, NextFunction } from 'express';
import { ForbiddenError, UnauthorizedError } from '../utils/customErrors';

export const checkPermissions = (allowedRoles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    // Requires authentication middleware to have run first, populating req.user
    if (!req.user) {
      next(new UnauthorizedError('Authentication credentials required.'));
      return;
    }

    const hasPermission = allowedRoles.includes(req.user.role);
    if (!hasPermission) {
      next(new ForbiddenError('You do not have permission to access this resource.'));
      return;
    }

    next();
  };
};
