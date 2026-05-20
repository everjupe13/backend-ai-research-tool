import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const { statusCode, message } = this.resolveException(exception);

    this.logger.error(`${req.method} ${req.url} → ${statusCode}: ${message}`);

    res.status(statusCode).json({
      statusCode,
      error: HttpStatus[statusCode] ?? 'UNKNOWN_ERROR',
      message,
    });
  }

  private resolveException(exception: unknown): {
    statusCode: number;
    message: string;
  } {
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const response = exception.getResponse();

      const message =
        typeof response === 'string'
          ? response
          : (response as { message?: string | string[] }).message
            ? Array.isArray(
                (response as { message: string | string[] }).message,
              )
              ? (response as { message: string[] }).message.join(', ')
              : ((response as { message: string }).message ?? exception.message)
            : exception.message;

      return { statusCode, message };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    };
  }
}
