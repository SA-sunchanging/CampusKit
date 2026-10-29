import { ConsoleLogger, type LogLevel } from '@nestjs/common';
import { currentCorrelationId } from './correlation-context.js';

/** The options ConsoleLogger passes to getJsonLogObject. */
interface JsonLogOptions {
  context: string;
  logLevel: LogLevel;
  writeStreamType?: 'stdout' | 'stderr';
  errorStack?: unknown;
  params?: Record<string, unknown>;
  error?: Error;
}

/**
 * Nest's console logger with the correlation ID of the work in progress: `[cid=<id>]` after the
 * context in text mode, a `correlationId` field in JSON mode. Lines outside any request or event
 * stay as they were. Installed by createHttpService, so every Logger call gains the ID.
 */
export class CorrelationLogger extends ConsoleLogger {
  protected override formatContext(context: string): string {
    const id = currentCorrelationId();
    const formatted = super.formatContext(context);
    return id === undefined ? formatted : `${formatted}[cid=${id}] `;
  }

  protected override getJsonLogObject(
    message: unknown,
    options: JsonLogOptions,
  ) {
    const id = currentCorrelationId();
    const object = super.getJsonLogObject(message, options);
    return id === undefined ? object : { ...object, correlationId: id };
  }
}
