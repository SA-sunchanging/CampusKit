import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type { Channel, ConsumeMessage } from 'amqplib';
import { BrokerConnection } from './broker-connection.js';
import { handleDelivery, settle } from './delivery.js';
import { InboxStoreService } from './inbox-store.service.js';
import { declareInboxTopology, INBOX_QUEUE } from './topology.js';

/**
 * Consumes every event from the durable exchange (ADR-008).
 * Acknowledge only after the inbox write; malformed events go to the dead-letter queue.
 * The broker connection retries in the background, so the service starts while RabbitMQ is down.
 */
@Injectable()
export class EventsConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventsConsumer.name);
  private readonly broker = new BrokerConnection({
    url:
      process.env.RABBITMQ_URL ?? 'amqp://campuskit:campuskit@localhost:5672',
    setup: (channel) => this.consume(channel),
  });

  constructor(private readonly inbox: InboxStoreService) {}

  onModuleInit(): void {
    this.broker.start();
  }

  async onModuleDestroy(): Promise<void> {
    await this.broker.stop();
  }

  private async consume(channel: Channel): Promise<void> {
    await declareInboxTopology(channel);
    await channel.consume(INBOX_QUEUE, (message: ConsumeMessage | null) => {
      if (!message) {
        // The broker cancelled the consumer; closing the channel triggers a reconnect.
        this.logger.warn(`Consumer of ${INBOX_QUEUE} was cancelled`);
        void channel.close().catch(() => undefined);
        return;
      }
      void this.deliver(channel, message);
    });
    this.logger.log(`Consuming ${INBOX_QUEUE}`);
  }

  private async deliver(
    channel: Channel,
    message: ConsumeMessage,
  ): Promise<void> {
    const decision = await handleDelivery(message.content, (envelope) =>
      this.inbox.store(envelope),
    );
    settle(channel, message, decision);
  }
}
