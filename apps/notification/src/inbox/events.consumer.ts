import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type { Channel, ConsumeMessage } from 'amqplib';
import { DeadLetterStoreService } from '../dead-letters/dead-letter-store.service.js';
import { BrokerConnection } from './broker-connection.js';
import { deliver } from './delivery.js';
import { InboxStoreService } from './inbox-store.service.js';
import {
  DEAD_LETTER_QUEUE,
  declareInboxTopology,
  INBOX_QUEUE,
} from './topology.js';

/**
 * Consumes every event from the durable exchange (ADR-008).
 * Acknowledge only after the inbox write; malformed events go to the dead-letter queue, whose
 * messages are kept in MongoDB for administrators to inspect.
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

  constructor(
    private readonly inbox: InboxStoreService,
    private readonly deadLetters: DeadLetterStoreService,
  ) {}

  onModuleInit(): void {
    this.broker.start();
  }

  async onModuleDestroy(): Promise<void> {
    await this.broker.stop();
  }

  private async consume(channel: Channel): Promise<void> {
    await declareInboxTopology(channel);
    await this.consumeQueue(channel, INBOX_QUEUE, (message) =>
      deliver(channel, message, (envelope) => this.inbox.store(envelope)),
    );
    await this.consumeQueue(channel, DEAD_LETTER_QUEUE, (message) =>
      this.deadLetters.keep(channel, message),
    );
  }

  private async consumeQueue(
    channel: Channel,
    queue: string,
    handle: (message: ConsumeMessage) => Promise<void>,
  ): Promise<void> {
    await channel.consume(queue, (message: ConsumeMessage | null) => {
      if (!message) {
        // The broker cancelled the consumer; closing the channel triggers a reconnect.
        this.logger.warn(`Consumer of ${queue} was cancelled`);
        void channel.close().catch(() => undefined);
        return;
      }
      void handle(message);
    });
    this.logger.log(`Consuming ${queue}`);
  }
}
