import { Logger } from '@nestjs/common';
import type { Channel, ConsumeMessage } from 'amqplib';
import { parseEnvelope, type InboxEnvelope } from './envelope.js';

/** What the consumer does with a message: ack it, dead-letter it, or put it back on the queue. */
export type DeliveryDecision = 'ack' | 'dead-letter' | 'requeue';

const logger = new Logger('InboxDelivery');

const reason = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Decides the fate of one message body (ADR-008): a body that is not JSON or not a valid
 * envelope is dead-lettered; an envelope is acked only after store succeeds; a store failure
 * is treated as transient and requeued. Never throws.
 */
export async function handleDelivery(
  content: Buffer,
  store: (envelope: InboxEnvelope) => Promise<void>,
): Promise<DeliveryDecision> {
  let raw: unknown;
  try {
    raw = JSON.parse(content.toString('utf8'));
  } catch {
    logger.warn('Dead-lettering a message that is not JSON');
    return 'dead-letter';
  }
  const envelope = parseEnvelope(raw);
  if (!envelope) {
    logger.warn('Dead-lettering a message that is not a valid event envelope');
    return 'dead-letter';
  }
  try {
    await store(envelope);
    return 'ack';
  } catch (error) {
    logger.error(
      `Requeueing ${envelope.type} (${envelope.eventId}): ${reason(error)}`,
    );
    return 'requeue';
  }
}

/**
 * Applies a decision to the message on its channel. When the channel has closed meanwhile,
 * the broker redelivers the message after the reconnect, so the error is only logged.
 */
export function settle(
  channel: Pick<Channel, 'ack' | 'nack'>,
  message: ConsumeMessage,
  decision: DeliveryDecision,
): void {
  try {
    if (decision === 'ack') {
      channel.ack(message);
    } else {
      channel.nack(message, false, decision === 'requeue');
    }
  } catch (error) {
    logger.warn(`Could not ${decision} a message: ${reason(error)}`);
  }
}
