import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { runWithCorrelationId } from './correlation-context.js';
import { CORRELATION_HEADER } from './correlation-id.middleware.js';

/**
 * Shapes every HTTP error as { error: { code, message } } with a string message. Validation
 * errors carry one message per failed rule; they are joined with "; ".
 */
@Catch()
export class ErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(ErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const res = http.getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const body =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const message = errorMessage(body);
    if (status >= 500 && status !== HttpStatus.NOT_IMPLEMENTED) {
      this.logUnexpected(exception, http.getRequest<Request>());
    }
    res
      .status(status)
      .json({ error: { code: HttpStatus[status] ?? 'ERROR', message } });
  }

  /** Logs under the request's correlation ID, so the line matches the caller's trace. */
  private logUnexpected(exception: unknown, req: Request): void {
    const id = req.headers[CORRELATION_HEADER];
    if (typeof id === 'string') {
      runWithCorrelationId(id, () => this.logger.error(exception));
    } else {
      this.logger.error(exception);
    }
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
