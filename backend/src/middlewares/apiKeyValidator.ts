import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '../utils/customErrors';

export const apiKeyValidatorMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  const apiKey = req.headers['x-api-key'] as string;
  
  if (!apiKey) {
    next(new UnauthorizedError('API Key is required. Please provide it in the X-API-Key header.'));
    return;
  }

  // Future-ready: Retrieve and validate this key from database per-tenant.
  // For Hackathon MVP/local testing, we can check against a master key in process.env if present.
  const masterKey = process.env.API_KEY || 'astramind_mvp_master_key_123';
  if (apiKey !== masterKey) {
    next(new UnauthorizedError('Invalid API Key provided.'));
    return;
  }

  next();
};
