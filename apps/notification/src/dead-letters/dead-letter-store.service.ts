import { runWithCorrelationId } from '@app/common';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Channel, ConsumeMessage } from 'amqplib';
import type { Model } from 'mongoose';
import { correlationIdOf, settle } from '../inbox/delivery.js';
import { countKeptDeadLetter } from '../metrics.js';
import { describeDeadLetter } from './dead-letter.js';
import { DeadLetter } from './dead-letter.schema.js';

const reason = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** Write side of dead_letters: the consumer of the dead-letter queue keeps each message here. */
@Injectable()
export class DeadLetterStoreService {
  private readonly logger = new Logger(DeadLetterStoreService.name);

  constructor(
    @InjectModel(DeadLetter.name) private readonly letters: Model<DeadLetter>,
  ) {}

  /**
   * Stores one dead-lettered message, then acks it, under its event's correlation ID.
   * The write is an upsert on the key that only sets fields on insert, so a redelivery changes
   * nothing. When MongoDB fails, the message is requeued and stays in the queue. Each kept
   * message is counted, so a growing count on the dashboard shows events that went nowhere.
   */
  keep(
    channel: Pick<Channel, 'ack' | 'nack'>,
    message: ConsumeMessage,
  ): Promise<void> {
    return runWithCorrelationId(correlationIdOf(message.content), async () => {
      const letter = describeDeadLetter(message);
      try {
        await this.letters
          .updateOne(
            { key: letter.key },
            { $setOnInsert: letter },
            { upsert: true },
          )
          .exec();
      } catch (error) {
        this.logger.error(`Requeueing a dead letter: ${reason(error)}`);
        settle(channel, message, 'requeue');
        return;
      }
      // Only broker-set fields go into the line; the body's fields could forge log lines.
      this.logger.warn(
        `Kept a dead letter from ${letter.queue ?? 'an unknown queue'} (${letter.reason ?? 'no reason'})`,
      );
      countKeptDeadLetter();
      settle(channel, message, 'ack');
    });
  }
}
