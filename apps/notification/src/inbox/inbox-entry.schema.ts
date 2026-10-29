import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { Types } from 'mongoose';

/**
 * One inbox record per (eventId, recipient); see docs/adr/adr-008-rabbitmq-events-with-transactional-outbox.md.
 * eventId and recipient are stored in lower case, so a UUID matches whatever case a caller sends.
 */
@Schema({ collection: 'inbox', timestamps: true })
export class InboxEntry {
  @Prop({ required: true })
  eventId: string;

  @Prop({ required: true })
  recipient: string;

  @Prop({ required: true })
  type: string;

  /** When the producer says the event happened; the inbox is ordered by it. */
  @Prop({ type: Date, required: true })
  occurredAt: Date;

  @Prop({ type: Object })
  data: Record<string, unknown>;

  /** Absent until the recipient reads the entry. */
  @Prop({ type: Date })
  readAt?: Date;
}

/** An inbox entry as a plain object read with lean(). */
export type InboxEntryRecord = Omit<InboxEntry, 'readAt'> & {
  _id: Types.ObjectId;
  readAt?: Date | null;
};

export const InboxEntrySchema = SchemaFactory.createForClass(InboxEntry);
InboxEntrySchema.index({ eventId: 1, recipient: 1 }, { unique: true });
/** GET /inbox: a recipient's newest entries first. */
InboxEntrySchema.index({ recipient: 1, occurredAt: -1, _id: -1 });
/** The unread count and read-all: a recipient's entries without readAt. */
InboxEntrySchema.index({ recipient: 1, readAt: 1 });
