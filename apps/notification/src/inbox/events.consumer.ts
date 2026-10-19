import { EVENTS_EXCHANGE, type EventEnvelope } from '@app/contracts';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { connect, type ChannelModel, type ConsumeMessage } from 'amqplib';

const QUEUE = 'notification.inbox';
const DEAD_LETTER_EXCHANGE = `${EVENTS_EXCHANGE}.dlx`;
const DEAD_LETTER_QUEUE = `${QUEUE}.dead`;

/**
 * Consumes every event from the durable exchange (ADR-008).
 * Acknowledge only after the inbox write; malformed events go to the dead-letter queue.
 */
@Injectable()
export class EventsConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventsConsumer.name);
  private connection?: ChannelModel;

  async onModuleInit(): Promise<void> {
    // TODO(Notification): reconnect when the broker restarts instead of only connecting at startup.
    this.connection = await connect(
      process.env.RABBITMQ_URL ?? 'amqp://campuskit:campuskit@localhost:5672',
    );
    const channel = await this.connection.createChannel();
    await channel.assertExchange(EVENTS_EXCHANGE, 'topic', { durable: true });
    await channel.assertExchange(DEAD_LETTER_EXCHANGE, 'fanout', {
      durable: true,
    });
    await channel.assertQueue(DEAD_LETTER_QUEUE, { durable: true });
    await channel.bindQueue(DEAD_LETTER_QUEUE, DEAD_LETTER_EXCHANGE, '');
    await channel.assertQueue(QUEUE, {
      durable: true,
      deadLetterExchange: DEAD_LETTER_EXCHANGE,
    });
    await channel.bindQueue(QUEUE, EVENTS_EXCHANGE, '#');
    await channel.consume(QUEUE, async (message: ConsumeMessage | null) => {
      if (!message) {
        return;
      }
      let event: EventEnvelope;
      try {
        event = JSON.parse(message.content.toString()) as EventEnvelope;
      } catch {
        channel.nack(message, false, false);
        return;
      }
      try {
        await this.handle(event);
        channel.ack(message);
      } catch (error) {
        this.logger.error(error);
        channel.nack(message, false, true);
      }
    });
    this.logger.log(`Consuming ${QUEUE}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.connection?.close().catch(() => undefined);
  }

  private async handle(event: EventEnvelope): Promise<void> {
    // TODO(Notification): validate the envelope and upsert one InboxEntry per recipient.
    this.logger.log(`Received ${event.type} (${event.eventId})`);
  }
}
