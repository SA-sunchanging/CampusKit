import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { AnyBulkWriteOperation, Model } from 'mongoose';
import type { InboxEnvelope } from './envelope.js';
import { InboxEntry } from './inbox-entry.schema.js';

/** Write side of the inbox: the RabbitMQ consumer stores each event here before it acks. */
@Injectable()
export class InboxStoreService {
  constructor(
    @InjectModel(InboxEntry.name) private readonly entries: Model<InboxEntry>,
  ) {}

  /**
   * Stores one entry per distinct recipient in a single bulk write. Each write is an upsert
   * that only sets fields on insert, so a redelivered event changes nothing (ADR-008).
   * An event without recipients writes nothing. Throws when MongoDB fails, so the consumer
   * requeues the message.
   */
  async store(envelope: InboxEnvelope): Promise<void> {
    const recipients = [
      ...new Set(envelope.recipients.map((id) => id.toLowerCase())),
    ];
    if (recipients.length === 0) {
      return;
    }
    const eventId = envelope.eventId.toLowerCase();
    const occurredAt = new Date(envelope.occurredAt);
    const now = new Date();
    const writes: AnyBulkWriteOperation<InboxEntry>[] = recipients.map(
      (recipient) => ({
        updateOne: {
          filter: { eventId, recipient },
          update: {
            $setOnInsert: {
              eventId,
              recipient,
              type: envelope.type,
              occurredAt,
              data: envelope.data,
              createdAt: now,
              updatedAt: now,
            },
          },
          upsert: true,
        },
      }),
    );
    // Timestamps are set on insert above; Mongoose's own would $set updatedAt on every redelivery.
    await this.entries.bulkWrite(writes, { ordered: false, timestamps: false });
  }
}
