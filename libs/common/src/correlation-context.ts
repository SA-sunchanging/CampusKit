import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { trace } from '@opentelemetry/api';

/** Short and log-safe: no spaces, line breaks, or other characters that could forge a log line. */
const VALID_ID = /^[A-Za-z0-9._-]{1,128}$/;

/** Span attribute that joins a request's trace with the traces of the events it caused. */
export const CORRELATION_SPAN_ATTRIBUTE = 'campuskit.correlation_id';

/**
 * The store lives on globalThis so telemetry/instrument.ts, which Node loads unbundled before the
 * service, reads the same one to tag every span with the ID.
 */
const STORE_KEY = Symbol.for('campuskit.correlation-store');
const globals = globalThis as Record<symbol, unknown>;
const storage = (globals[STORE_KEY] ??=
  new AsyncLocalStorage<string>()) as AsyncLocalStorage<string>;

/** The value when it is a valid correlation ID; otherwise a new UUID. A caller's value is never trusted as is. */
export function correlationIdFrom(value: unknown): string {
  return typeof value === 'string' && VALID_ID.test(value)
    ? value
    : randomUUID();
}

/**
 * Runs fn, and everything it starts asynchronously, under the given correlation ID, so every log
 * line written meanwhile carries it. Concurrent runs keep their own IDs; a nested run overrides
 * the outer ID until it ends. The open span, if any, is tagged with the ID.
 */
export function runWithCorrelationId<T>(id: string, fn: () => T): T {
  // The span already open (the incoming request's) started before the ID was known.
  trace.getActiveSpan()?.setAttribute(CORRELATION_SPAN_ATTRIBUTE, id);
  return storage.run(id, fn);
}

/** The correlation ID of the work in progress, or undefined outside runWithCorrelationId. */
export function currentCorrelationId(): string | undefined {
  return storage.getStore();
}
