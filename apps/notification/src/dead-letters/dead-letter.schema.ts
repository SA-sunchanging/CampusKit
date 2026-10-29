import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { Types } from 'mongoose';

/**
 * One message the inbox consumer dead-lettered, kept so an administrator can inspect it
 * (see dead-letter.ts for the key). Envelope and x-death fields are absent when the message
 * does not carry them.
 */
@Schema({ collection: 'dead_letters' })
export class DeadLetter {
  @Prop({ required: true })
  key: string;

  /** The body as UTF-8 text, cut to MAX_CONTENT_LENGTH characters. */
  @Prop({ required: true })
  content: string;

  /** The body's length in bytes. */
  @Prop({ required: true })
  size: number;

  @Prop({ required: true })
  routingKey: string;

  @Prop()
  eventId?: string;

  @Prop()
  type?: string;

  @Prop()
  correlationId?: string;

  /** Why RabbitMQ dead-lettered it, for example "rejected". */
  @Prop()
  reason?: string;

  /** The queue it was dead-lettered from. */
  @Prop()
  queue?: string;

  /** How often it was dead-lettered from that queue for that reason. */
  @Prop()
  count?: number;

  @Prop({ type: Date })
  deadLetteredAt?: Date;

  /** When Notification took it from the dead-letter queue; the list is ordered by it. */
  @Prop({ type: Date, required: true })
  receivedAt: Date;
}

/** A dead letter as a plain object read with lean(). */
export type DeadLetterRecord = DeadLetter & { _id: Types.ObjectId };

export const DeadLetterSchema = SchemaFactory.createForClass(DeadLetter);
DeadLetterSchema.index({ key: 1 }, { unique: true });
/** GET /admin/dead-letters: newest first. */
DeadLetterSchema.index({ receivedAt: -1, _id: -1 });
