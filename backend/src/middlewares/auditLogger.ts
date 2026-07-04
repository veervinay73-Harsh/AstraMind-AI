import { Request, Response, NextFunction } from 'express';
import { Logger } from '../utils/logger';

export const auditLoggerMiddleware = (action: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    res.on('finish', () => {
      // Only audit successful mutations or attempted sensitive operations
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const userId = req.user?.id || 'ANONYMOUS_CALLER';
        const hospitalId = req.hospitalId || req.user?.hospitalId || 'SYSTEM';
        const reqId = req.id || 'N/A';
        const ip = req.ip || req.socket.remoteAddress || 'unknown';

        const auditMsg = `AUDIT LOG - Action: ${action} - User: ${userId} - Tenant: ${hospitalId} - Status: ${res.statusCode} - ReqID: ${reqId} - IP: ${ip}`;
        
        Logger.info(auditMsg, 'AUDIT');
        
        // Future-ready: Insert log record asynchronously in database
        // prisma.auditLog.create({ data: { action, userId, hospitalId, ip, details: ... } })
      }
    });

    next();
  };
};
