import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

/** Short and log-safe: no spaces, line breaks, or other characters that could forge a log line. */
const VALID_ID = /^[A-Za-z0-9._-]{1,128}$/;

const storage = new AsyncLocalStorage<string>();

/** The value when it is a valid correlation ID; otherwise a new UUID. A caller's value is never trusted as is. */
export function correlationIdFrom(value: unknown): string {
  return typeof value === 'string' && VALID_ID.test(value)
    ? value
    : randomUUID();
}

/**
 * Runs fn, and everything it starts asynchronously, under the given correlation ID, so every log
 * line written meanwhile carries it. Concurrent runs keep their own IDs; a nested run overrides
 * the outer ID until it ends.
 */
export function runWithCorrelationId<T>(id: string, fn: () => T): T {
  return storage.run(id, fn);
}

/** The correlation ID of the work in progress, or undefined outside runWithCorrelationId. */
export function currentCorrelationId(): string | undefined {
  return storage.getStore();
}
