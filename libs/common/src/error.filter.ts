import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

/**
 * Shapes every HTTP error as { error: { code, message } } with a string message. Validation
 * errors carry one message per failed rule; they are joined with "; ".
 */
@Catch()
export class ErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(ErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const body =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const message = errorMessage(body);
    if (status >= 500 && status !== HttpStatus.NOT_IMPLEMENTED) {
      this.logger.error(exception);
    }
    res
      .status(status)
      .json({ error: { code: HttpStatus[status] ?? 'ERROR', message } });
  }
}

function errorMessage(body: unknown): string {
  if (typeof body === 'string') {
    return body;
  }
  const message = (body as { message?: unknown } | undefined)?.message;
  if (Array.isArray(message)) {
    return message.map(String).join('; ');
  }
  return typeof message === 'string' ? message : 'Internal server error';
}
