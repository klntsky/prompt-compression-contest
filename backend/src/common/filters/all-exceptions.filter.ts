import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core'; // Preferred way to get request/response for more abstract server setups

interface ErrorResponse {
  statusCode: number;
  message: string | string[] | Record<string, any>; // For class-validator details
  error?: string;
}

/**
 * @class AllExceptionsFilter
 * @description Catches all unhandled exceptions and standardizes the error response format.
 * This filter ensures that clients receive a consistent error structure regardless of the error type.
 */
@Catch() // Catch all exceptions if no specific type is provided to @Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name); // For logging unexpected errors

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  /**
   * @method catch
   * @description Handles the caught exception and formats the response.
   * @param exception - The exception that was caught.
   * @param host - The ArgumentsHost providing access to the request/response context.
   */
  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();

    const httpStatus =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const path = httpAdapter.getRequestUrl(ctx.getRequest());
    const timestamp = new Date().toISOString();

    let exceptionName = 'UnknownException';
    if (
      exception &&
      typeof exception === 'object' &&
      exception.constructor &&
      typeof exception.constructor.name === 'string'
    ) {
      exceptionName = exception.constructor.name;
    }

    let responsePayload: {
      statusCode: number;
      timestamp: string;
      path: string;
      error: { type: string; message: string | object; details?: any };
    };

    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      let errorMessage: string | object;
      let errorDetails: any = undefined;

      if (typeof exceptionResponse === 'string') {
        errorMessage = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const typedResponse = exceptionResponse as ErrorResponse;
        errorMessage =
          typedResponse.message ||
          'HttpException without a specific message format.';
        // Preserve the structured error details from class-validator or similar
        // NestJS standard error objects for validation have statusCode, message (array), error.
        if (
          typedResponse.statusCode &&
          typedResponse.error &&
          Array.isArray(typedResponse.message)
        ) {
          errorDetails = { ...typedResponse }; // Capture the full standard error object
        } else {
          // If it's some other object structure, capture it as details.
          errorDetails = { ...typedResponse };
        }
      } else {
        errorMessage = 'Unexpected HttpException response format';
      }

      responsePayload = {
        statusCode: httpStatus,
        timestamp,
        path,
        error: {
          type: exceptionName,
          message: errorMessage,
          details: errorDetails, // Assign the captured details
        },
      };
    } else {
      const message =
        exception instanceof Error
          ? exception.message
          : 'An unexpected internal server error occurred.';
      this.logger.error(
        `Unhandled exception: ${path} - ${message}`,
        exception instanceof Error ? exception.stack : String(exception),
        exceptionName,
      );

      responsePayload = {
        statusCode: httpStatus,
        timestamp,
        path,
        error: {
          type: exceptionName,
          message: 'An unexpected internal server error occurred.',
        },
      };
      if (process.env.NODE_ENV !== 'production' && exception instanceof Error) {
        responsePayload.error.details = exception.stack; // Assign stack as details
      }
    }
    httpAdapter.reply(ctx.getResponse(), responsePayload, httpStatus);
  }
}
