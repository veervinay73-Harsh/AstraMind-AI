import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      id?: string;
      correlationId?: string;
      hospitalId?: string;
      user?: {
        id: string;
        role: string;
        hospitalId: string;
      };
    }
  }
}
