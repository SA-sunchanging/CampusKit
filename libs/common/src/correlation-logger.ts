import { ConsoleLogger, type LogLevel } from '@nestjs/common';
import { isSpanContextValid, trace } from '@opentelemetry/api';
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

/** The trace ID of the open span, or undefined when nothing is traced. */
function currentTraceId(): string | undefined {
  const context = trace.getActiveSpan()?.spanContext();
  return context !== undefined && isSpanContextValid(context)
    ? context.traceId
    : undefined;
}

/**
 * Nest's console logger with the correlation ID of the work in progress: `[cid=<id>]` after the
 * context in text mode, a `correlationId` field in JSON mode. When the work is traced, the trace ID
 * follows as `[trace=<id>]` or a `traceId` field, to open it in Jaeger. Lines outside any request
 * or event stay as they were. Installed by createHttpService, so every Logger call gains the IDs.
 */
export class CorrelationLogger extends ConsoleLogger {
  protected override formatContext(context: string): string {
    const id = currentCorrelationId();
    const traceId = currentTraceId();
    let formatted = super.formatContext(context);
    if (id !== undefined) {
      formatted += `[cid=${id}] `;
    }
    if (traceId !== undefined) {
      formatted += `[trace=${traceId}] `;
    }
    return formatted;
  }

  protected override getJsonLogObject(
    message: unknown,
    options: JsonLogOptions,
  ) {
    const id = currentCorrelationId();
    const traceId = currentTraceId();
    return {
      ...super.getJsonLogObject(message, options),
      ...(id === undefined ? {} : { correlationId: id }),
      ...(traceId === undefined ? {} : { traceId }),
    };
  }
}
