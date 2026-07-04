import { Response } from 'express';

export interface ApiResponseFormat<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code: string;
    details?: any;
  };
  timestamp: string;
}

export class ApiResponse {
  /**
   * Send a standardized success response.
   */
  public static success<T>(
    res: Response,
    data: T,
    statusCode: number = 200
  ): Response<ApiResponseFormat<T>> {
    const responseBody: ApiResponseFormat<T> = {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
    return res.status(statusCode).json(responseBody);
  }

  /**
   * Send a standardized error response.
   */
  public static error(
    res: Response,
    message: string,
    statusCode: number = 500,
    errorCode: string = 'INTERNAL_SERVER_ERROR',
    details?: any
  ): Response<ApiResponseFormat> {
    const responseBody: ApiResponseFormat = {
      success: false,
      error: {
        message,
        code: errorCode,
        details,
      },
      timestamp: new Date().toISOString(),
    };
    return res.status(statusCode).json(responseBody);
  }
}
