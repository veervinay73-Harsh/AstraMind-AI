export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly errorCode?: string;
  public readonly details?: any;

  constructor(message: string, statusCode: number, errorCode?: string, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.errorCode = errorCode;
    this.details = details;

    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string = 'Bad Request', errorCode?: string, details?: any) {
    super(message, 400, errorCode || 'BAD_REQUEST', details);
  }
}

export class ValidationError extends AppError {
  constructor(message: string = 'Validation Error', details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized', errorCode?: string) {
    super(message, 401, errorCode || 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden', errorCode?: string) {
    super(message, 403, errorCode || 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource Not Found', errorCode?: string) {
    super(message, 404, errorCode || 'NOT_FOUND');
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = 'Internal Server Error') {
    super(message, 500, 'INTERNAL_SERVER_ERROR');
    // Internal server errors are generally not considered user-operational
    (this as any).isOperational = false;
  }
}
