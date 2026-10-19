import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { connect, type ChannelModel, type ConfirmChannel } from 'amqplib';
import { EVENTS_EXCHANGE, type EventEnvelope } from '@app/contracts';

/**
 * Publishes events to the durable RabbitMQ exchange and waits for the broker's confirmation.
 * ADR-008 calls this from an outbox relay after the domain transaction commits; until the outbox
 * exists, a service may call it directly after its commit.
 */
@Injectable()
export class EventPublisher implements OnModuleDestroy {
  private readonly logger = new Logger(EventPublisher.name);
  private connection?: ChannelModel;
  private channel?: ConfirmChannel;

  async publish(event: EventEnvelope): Promise<void> {
    const channel = await this.getChannel();
    channel.publish(
      EVENTS_EXCHANGE,
      event.type,
      Buffer.from(JSON.stringify(event)),
      {
        persistent: true,
        contentType: 'application/json',
        messageId: event.eventId,
      },
    );
    await channel.waitForConfirms();
  }

  async onModuleDestroy(): Promise<void> {
    await this.connection?.close().catch(() => undefined);
  }

  private async getChannel(): Promise<ConfirmChannel> {
    if (this.channel) {
      return this.channel;
    }
    this.connection = await connect(
      process.env.RABBITMQ_URL ?? 'amqp://campuskit:campuskit@localhost:5672',
    );
    this.connection.on('close', () => {
      this.logger.warn('RabbitMQ connection closed');
      this.channel = undefined;
      this.connection = undefined;
    });
    const channel = await this.connection.createConfirmChannel();
    await channel.assertExchange(EVENTS_EXCHANGE, 'topic', { durable: true });
    this.channel = channel;
    return channel;
  }
}
