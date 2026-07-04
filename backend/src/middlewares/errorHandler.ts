import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/customErrors';
import { ApiResponse } from '../utils/apiResponse';
import { Logger } from '../utils/logger';

export const errorHandlerMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void => {
  const reqId = req.id || 'N/A';
  
  if (err instanceof AppError) {
    // Known operational error (e.g. ValidationError, NotFoundError)
    Logger.warn(`Operational Error [ReqID: ${reqId}]: ${err.message} (${err.statusCode})`);
    
    ApiResponse.error(
      res,
      err.message,
      err.statusCode,
      err.errorCode || 'ERROR',
      err.details
    );
    return;
  }

  // Unhandled internal error
  Logger.error(`Unhandled System Exception [ReqID: ${reqId}]: ${err.message}`, err);

  // Send a safe generic error response to clients (avoiding stack leak)
  ApiResponse.error(
    res,
    'An unexpected system error occurred.',
    500,
    'INTERNAL_SERVER_ERROR'
  );
};
