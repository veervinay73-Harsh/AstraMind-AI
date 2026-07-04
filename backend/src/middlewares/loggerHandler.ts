import { Request, Response, NextFunction } from 'express';
import { Logger } from '../utils/logger';

export const loggerMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const start = process.hrtime();
  
  res.on('finish', () => {
    const diff = process.hrtime(start);
    const timeInMs = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2);
    
    const method = req.method;
    const url = req.originalUrl || req.url;
    const status = res.statusCode;
    const ip = req.ip || req.socket.remoteAddress;
    const reqId = req.id || 'N/A';

    const logMsg = `${method} ${url} - Status: ${status} - Duration: ${timeInMs}ms - IP: ${ip} - ReqID: ${reqId}`;
    
    if (status >= 500) {
      Logger.error(logMsg);
    } else if (status >= 400) {
      Logger.warn(logMsg);
    } else {
      Logger.info(logMsg);
    }
  });

  next();
};
