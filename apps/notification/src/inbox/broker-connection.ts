import { Logger } from '@nestjs/common';
import {
  connect as amqpConnect,
  type Channel,
  type ChannelModel,
} from 'amqplib';

/** The first retry waits this long; each failure doubles it up to MAX_RETRY_DELAY_MS. */
export const INITIAL_RETRY_DELAY_MS = 1_000;
export const MAX_RETRY_DELAY_MS = 30_000;

export interface BrokerConnectionOptions {
  url: string;
  /** Declares the topology and starts consuming on a fresh channel; runs after every connect. */
  setup: (channel: Channel) => Promise<void>;
  /** Defaults to amqplib's connect; tests pass a fake. */
  connect?: (url: string) => Promise<ChannelModel>;
}

const reason = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Keeps one RabbitMQ connection and channel alive. start() returns at once and connects in the
 * background, so the service boots while the broker is down. A failed connect or setup, or a
 * connection or channel that closes later, schedules a new attempt after a backoff that starts
 * at 1 s, doubles to at most 30 s, and resets after a successful setup. stop() closes the
 * connection and cancels any pending attempt for good.
 */
export class BrokerConnection {
  private readonly logger = new Logger(BrokerConnection.name);
  private readonly connectFn: (url: string) => Promise<ChannelModel>;
  private connection?: ChannelModel;
  private timer?: ReturnType<typeof setTimeout>;
  private delay = INITIAL_RETRY_DELAY_MS;
  private stopped = false;

  constructor(private readonly options: BrokerConnectionOptions) {
    this.connectFn = options.connect ?? ((url) => amqpConnect(url));
  }

  start(): void {
    void this.attempt();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    clearTimeout(this.timer);
    this.timer = undefined;
    const connection = this.connection;
    this.connection = undefined;
    await connection?.close().catch(() => undefined);
  }

  private async attempt(): Promise<void> {
    this.timer = undefined;
    if (this.stopped) {
      return;
    }
    let connection: ChannelModel | undefined;
    let lost = false;
    const onLost = (error?: unknown): void => {
      if (lost) {
        return;
      }
      lost = true;
      if (this.connection === connection) {
        this.connection = undefined;
      }
      void connection?.close().catch(() => undefined);
      if (!this.stopped) {
        this.logger.warn(`RabbitMQ unavailable: ${reason(error ?? 'closed')}`);
        this.scheduleRetry();
      }
    };
    try {
      connection = await this.connectFn(this.options.url);
      connection.on('error', onLost);
      connection.on('close', onLost);
      if (this.stopped) {
        onLost();
        return;
      }
      const channel = await connection.createChannel();
      channel.on('error', onLost);
      channel.on('close', onLost);
      await this.options.setup(channel);
    } catch (error) {
      onLost(error);
      return;
    }
    if (this.stopped || lost) {
      onLost();
      return;
    }
    this.connection = connection;
    this.delay = INITIAL_RETRY_DELAY_MS;
    this.logger.log('Connected to RabbitMQ');
  }

  private scheduleRetry(): void {
    const delay = this.delay;
    this.delay = Math.min(this.delay * 2, MAX_RETRY_DELAY_MS);
    this.logger.log(`Reconnecting to RabbitMQ in ${delay} ms`);
    this.timer = setTimeout(() => void this.attempt(), delay);
  }
}
