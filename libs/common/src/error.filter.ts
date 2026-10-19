import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

/** Shapes every HTTP error as { error: { code, message } }. */
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
    const message =
      typeof body === 'string'
        ? body
        : ((body as { message?: unknown } | undefined)?.message ??
          'Internal server error');
    if (status >= 500 && status !== HttpStatus.NOT_IMPLEMENTED) {
      this.logger.error(exception);
    }
    res
      .status(status)
      .json({ error: { code: HttpStatus[status] ?? 'ERROR', message } });
  }
}
