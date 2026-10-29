import { EVENTS_EXCHANGE } from '@app/contracts';
import type { Channel } from 'amqplib';

export const INBOX_QUEUE = 'notification.inbox';
export const DEAD_LETTER_EXCHANGE = `${EVENTS_EXCHANGE}.dlx`;
export const DEAD_LETTER_QUEUE = `${INBOX_QUEUE}.dead`;
/** Unacknowledged messages the broker hands this consumer at once. */
export const PREFETCH = 10;

/**
 * Declares the exchanges and queues the inbox consumer needs (ADR-008): a durable queue bound to
 * every event, whose rejected messages go through a fanout exchange to a dead-letter queue.
 * Safe to repeat after a reconnect. Changing a queue's arguments makes RabbitMQ refuse the
 * declaration while the old queue exists.
 */
export async function declareInboxTopology(channel: Channel): Promise<void> {
  await channel.assertExchange(EVENTS_EXCHANGE, 'topic', { durable: true });
  await channel.assertExchange(DEAD_LETTER_EXCHANGE, 'fanout', {
    durable: true,
  });
  await channel.assertQueue(DEAD_LETTER_QUEUE, { durable: true });
  await channel.bindQueue(DEAD_LETTER_QUEUE, DEAD_LETTER_EXCHANGE, '');
  await channel.assertQueue(INBOX_QUEUE, {
    durable: true,
    deadLetterExchange: DEAD_LETTER_EXCHANGE,
  });
  await channel.bindQueue(INBOX_QUEUE, EVENTS_EXCHANGE, '#');
  await channel.prefetch(PREFETCH);
}
