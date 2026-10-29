import { randomUUID } from 'node:crypto';
import type { EventEnvelope } from '@app/contracts';
import type { EntityManager } from 'typeorm';

/** The producer name in every Booking event envelope. */
export const PRODUCER = 'booking';

export interface OutboxMessage<T> {
  type: string;
  recipients: string[];
  correlationId: string;
  data: T;
}

/**
 * Stores an event in outbox_events inside the caller's transaction, so the event exists exactly
 * when the change it describes commits. The outbox row ID is the envelope's eventId.
 */
export async function writeOutbox<T>(
  tx: EntityManager,
  message: OutboxMessage<T>,
  now = new Date(),
): Promise<EventEnvelope<T>> {
  const envelope: EventEnvelope<T> = {
    eventId: randomUUID(),
    type: message.type,
    occurredAt: now.toISOString(),
    correlationId: message.correlationId,
    producer: PRODUCER,
    recipients: message.recipients,
    data: message.data,
  };
  await tx.query(
    `INSERT INTO outbox_events (id, type, envelope) VALUES ($1, $2, $3::jsonb)`,
    [envelope.eventId, envelope.type, JSON.stringify(envelope)],
  );
  return envelope;
}
