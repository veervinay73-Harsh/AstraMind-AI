import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../utils/apiResponse';

interface RateLimitInfo {
  count: number;
  resetTime: number;
}

const ipCache = new Map<string, RateLimitInfo>();

// Simple cleanup routine to prevent memory leaks in memory cache
setInterval(() => {
  const now = Date.now();
  for (const [ip, info] of ipCache.entries()) {
    if (now > info.resetTime) {
      ipCache.delete(ip);
    }
  }
}, 5 * 60 * 1000); // Clean every 5 minutes

export const rateLimiterMiddleware = (
  windowMs: number = 60 * 1000, // 1 minute window
  maxRequests: number = 100     // Limit each IP to 100 requests per window
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Treat proxy forwards as IP source if configured, fallback to standard socket IP
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    const info = ipCache.get(ip);

    if (!info) {
      ipCache.set(ip, {
        count: 1,
        resetTime: now + windowMs,
      });
      next();
      return;
    }

    if (now > info.resetTime) {
      info.count = 1;
      info.resetTime = now + windowMs;
      ipCache.set(ip, info);
      next();
      return;
    }

    info.count += 1;
    ipCache.set(ip, info);

    const remaining = Math.max(0, maxRequests - info.count);
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(info.resetTime / 1000));

    if (info.count > maxRequests) {
      res.setHeader('Retry-After', Math.ceil((info.resetTime - now) / 1000));
      ApiResponse.error(
        res,
        'Too many requests, please try again later.',
        429,
        'TOO_MANY_REQUESTS'
      );
      return;
    }

    next();
  };
};
