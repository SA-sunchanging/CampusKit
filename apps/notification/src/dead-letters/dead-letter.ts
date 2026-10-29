import { createHash } from 'node:crypto';
import type { ConsumeMessage } from 'amqplib';

/** Longer bodies are cut to this many characters; size keeps the original length in bytes. */
export const MAX_CONTENT_LENGTH = 65_536;

/** Envelope fields longer than this are not kept; a valid envelope never comes close. */
const MAX_FIELD_LENGTH = 256;

/** What the dead_letters collection stores about one dead-lettered message. */
export interface DeadLetterFields {
  key: string;
  content: string;
  size: number;
  routingKey: string;
  eventId?: string;
  type?: string;
  correlationId?: string;
  reason?: string;
  queue?: string;
  count?: number;
  deadLetteredAt?: Date;
  receivedAt: Date;
}

/** One entry of RabbitMQ's x-death header, as amqplib decodes it. */
interface XDeath {
  reason?: unknown;
  queue?: unknown;
  count?: unknown;
  time?: unknown;
}

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length <= MAX_FIELD_LENGTH
    ? value
    : undefined;

/** amqplib decodes an AMQP timestamp, in seconds, as { '!': 'timestamp', value }. */
function timestamp(value: unknown): Date | undefined {
  const seconds = (value as { value?: unknown } | undefined)?.value;
  return typeof seconds === 'number' ? new Date(seconds * 1000) : undefined;
}

/** The envelope fields a body carries, if it is a JSON object; a dead letter is often neither. */
function envelopeFields(
  content: string,
): Pick<DeadLetterFields, 'eventId' | 'type' | 'correlationId'> {
  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    return {};
  }
  if (typeof raw !== 'object' || raw === null) {
    return {};
  }
  const { eventId, type, correlationId } = raw as Record<string, unknown>;
  return {
    eventId: text(eventId),
    type: text(type),
    correlationId: text(correlationId),
  };
}

/**
 * Describes a message from the dead-letter queue: its body, the envelope fields it carries, and
 * the latest x-death entry (why, from which queue, how often). The key is a SHA-256 of the body
 * and the time RabbitMQ first dead-lettered it from that queue, so a redelivered dead letter
 * maps to the same record, while the same body dead-lettered again later gets its own.
 */
export function describeDeadLetter(
  message: Pick<ConsumeMessage, 'content' | 'fields' | 'properties'>,
  receivedAt = new Date(),
): DeadLetterFields {
  const body = message.content.toString('utf8');
  const deaths: unknown = message.properties.headers?.['x-death'];
  const death: XDeath = Array.isArray(deaths) ? (deaths[0] as XDeath) : {};
  const deadLetteredAt = timestamp(death.time);
  const key = createHash('sha256')
    .update(message.content)
    .update(`\n${deadLetteredAt?.toISOString() ?? ''}`)
    .digest('hex');
  return {
    key,
    content: body.slice(0, MAX_CONTENT_LENGTH),
    size: message.content.length,
    routingKey: message.fields.routingKey,
    ...envelopeFields(body),
    reason: text(death.reason),
    queue: text(death.queue),
    count: typeof death.count === 'number' ? death.count : undefined,
    deadLetteredAt,
    receivedAt,
  };
}
