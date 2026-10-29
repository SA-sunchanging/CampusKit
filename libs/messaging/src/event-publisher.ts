import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { connect, type ChannelModel, type ConfirmChannel } from 'amqplib';
import { EVENTS_EXCHANGE, type EventEnvelope } from '@app/contracts';

/** The first reconnect waits this long; each failure doubles it up to MAX_RECONNECT_DELAY_MS. */
export const INITIAL_RECONNECT_DELAY_MS = 1_000;
export const MAX_RECONNECT_DELAY_MS = 30_000;

/** Thrown by publish while the broker is unreachable; the publisher already logged the outage. */
export class BrokerUnavailableError extends Error {
  constructor() {
    super('RabbitMQ is unavailable');
    this.name = BrokerUnavailableError.name;
  }
}

const reason = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Publishes events to the durable RabbitMQ exchange and waits for the broker's confirmation.
 * ADR-008 calls this from an outbox relay after the domain transaction commits.
 * Connects on the first publish. When the connection fails or is lost, it reconnects in the
 * background after a delay that starts at 1 s and doubles to at most 30 s; meanwhile publish
 * fails at once with BrokerUnavailableError. An outage is logged once when it starts and once
 * when the broker is back.
 */
@Injectable()
export class EventPublisher implements OnModuleDestroy {
  private readonly logger = new Logger(EventPublisher.name);
  private connection?: ChannelModel;
  private channel?: ConfirmChannel;
  private connecting?: Promise<ConfirmChannel>;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private delay = INITIAL_RECONNECT_DELAY_MS;
  private down = false;
  private stopped = false;

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
    this.stopped = true;
    clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
    const connection = this.connection;
    this.connection = undefined;
    this.channel = undefined;
    await connection?.close().catch(() => undefined);
  }

  private getChannel(): Promise<ConfirmChannel> {
    if (this.channel) {
      return Promise.resolve(this.channel);
    }
    if (this.stopped || this.retryTimer) {
      return Promise.reject(new BrokerUnavailableError());
    }
    this.connecting ??= this.open().finally(() => {
      this.connecting = undefined;
    });
    return this.connecting;
  }

  private async open(): Promise<ConfirmChannel> {
    let connection: ChannelModel | undefined;
    try {
      connection = await connect(
        process.env.RABBITMQ_URL ?? 'amqp://campuskit:campuskit@localhost:5672',
      );
      // Without an error listener, a connection error would crash the process.
      const opened = connection;
      const onLost = (error?: unknown): void => this.lose(opened, error);
      connection.on('error', onLost);
      connection.on('close', onLost);
      const channel = await connection.createConfirmChannel();
      channel.on('error', onLost);
      channel.on('close', onLost);
      await channel.assertExchange(EVENTS_EXCHANGE, 'topic', { durable: true });
      if (this.stopped) {
        throw new BrokerUnavailableError();
      }
      this.connection = connection;
      this.channel = channel;
      this.recovered();
      return channel;
    } catch (error) {
      void connection?.close().catch(() => undefined);
      this.failed(error);
      throw new BrokerUnavailableError();
    }
  }

  /** The current connection or its channel failed or closed; ignored for an old connection. */
  private lose(connection: ChannelModel, error?: unknown): void {
    if (this.connection !== connection) {
      return;
    }
    this.connection = undefined;
    this.channel = undefined;
    void connection.close().catch(() => undefined);
    this.failed(error ?? 'connection closed');
  }

  private failed(error: unknown): void {
    if (this.stopped || this.retryTimer) {
      return;
    }
    if (!this.down) {
      this.down = true;
      this.logger.warn(
        `RabbitMQ unavailable, events wait in the outbox: ${reason(error)}`,
      );
    }
    const delay = this.delay;
    this.delay = Math.min(this.delay * 2, MAX_RECONNECT_DELAY_MS);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined;
      void this.getChannel().catch(() => undefined);
    }, delay);
  }

  private recovered(): void {
    this.delay = INITIAL_RECONNECT_DELAY_MS;
    if (this.down) {
      this.down = false;
      this.logger.log('RabbitMQ is back; publishing resumes');
    }
  }
}
