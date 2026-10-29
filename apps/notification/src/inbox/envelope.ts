import type { EventEnvelope } from '@app/contracts';
import { isISO8601, isUUID } from 'class-validator';

/** An envelope that passed parseEnvelope: its data is always a plain object. */
export type InboxEnvelope = EventEnvelope<Record<string, unknown>>;

const isText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== '';

const isUuid = (value: unknown): value is string => isUUID(value);

const isUuidList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(isUuid);

/** A non-null, non-array object whose prototype is Object.prototype or null. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** A complete ISO-8601 timestamp that Date can read. */
const isTimestamp = (value: unknown): value is string =>
  isText(value) &&
  isISO8601(value, { strict: true, strictSeparator: true }) &&
  !Number.isNaN(Date.parse(value));

/**
 * Checks a decoded RabbitMQ message against the event contract in libs/contracts/src/events.ts.
 * Returns the envelope, or undefined when any field is missing or has the wrong shape, so the
 * consumer can dead-letter it. An empty recipient list is valid: nobody gets a notice.
 */
export function parseEnvelope(raw: unknown): InboxEnvelope | undefined {
  if (!isPlainObject(raw)) {
    return undefined;
  }
  const {
    eventId,
    type,
    occurredAt,
    correlationId,
    producer,
    recipients,
    data,
  } = raw;
  if (
    !isUuid(eventId) ||
    !isText(type) ||
    !isTimestamp(occurredAt) ||
    !isText(correlationId) ||
    !isText(producer) ||
    !isUuidList(recipients) ||
    !isPlainObject(data)
  ) {
    return undefined;
  }
  return {
    eventId,
    type,
    occurredAt,
    correlationId,
    producer,
    recipients,
    data,
  };
}
