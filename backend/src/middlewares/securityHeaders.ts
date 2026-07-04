import { Request, Response, NextFunction } from 'express';

export const securityHeadersMiddleware = (_req: Request, res: Response, next: NextFunction): void => {
  // Prevent mime-type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Protect against clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Basic cross-site scripting (XSS) filter protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer information control
  res.setHeader('Referrer-Policy', 'no-referrer');
  
  // Prevent browser caching of sensitive APIs (good default, can override)
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  // Enforce HSTS (Strict-Transport-Security) in production
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  next();
};
