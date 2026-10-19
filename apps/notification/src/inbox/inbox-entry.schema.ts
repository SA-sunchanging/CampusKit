import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

/** One inbox record per (eventId, recipient); see docs/adr/adr-008-rabbitmq-events-with-transactional-outbox.md. */
@Schema({ collection: 'inbox', timestamps: true })
export class InboxEntry {
  @Prop({ required: true })
  eventId: string;

  @Prop({ required: true, index: true })
  recipient: string;

  @Prop({ required: true })
  type: string;

  @Prop({ type: Object })
  data: Record<string, unknown>;

  @Prop()
  readAt?: Date;
}

export const InboxEntrySchema = SchemaFactory.createForClass(InboxEntry);
InboxEntrySchema.index({ eventId: 1, recipient: 1 }, { unique: true });
