import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { Types } from 'mongoose';

export const REVIEWER_ROLES = ['owner', 'renter'] as const;
export type ReviewerRole = (typeof REVIEWER_ROLES)[number];

/**
 * One participant's review of the other after a CLOSED rental. User and rental IDs are stored
 * in lower case, so a UUID matches whatever case a caller sends.
 */
@Schema({
  collection: 'reviews',
  timestamps: { createdAt: true, updatedAt: false },
})
export class Review {
  @Prop({ required: true })
  rentalId: string;

  @Prop({ required: true })
  listingId: string;

  @Prop({ required: true })
  reviewerId: string;

  /** The other participant of the rental. */
  @Prop({ required: true })
  revieweeId: string;

  /** The reviewer's side of the rental. */
  @Prop({ type: String, required: true, enum: REVIEWER_ROLES })
  reviewerRole: ReviewerRole;

  /** Whole stars, 1 to 5. */
  @Prop({ required: true })
  rating: number;

  /** Trimmed; absent when the reviewer wrote nothing. */
  @Prop()
  comment?: string;
}

/** A review as a plain object read with lean(). */
export type ReviewRecord = Review & {
  _id: Types.ObjectId;
  comment?: string | null;
  createdAt: Date;
};

export const ReviewSchema = SchemaFactory.createForClass(Review);
/** One review per participant and rental; a second attempt fails with a duplicate key. */
ReviewSchema.index({ rentalId: 1, reviewerId: 1 }, { unique: true });
/** GET /reviews?userId and the reputation: the reviews a user received, newest first. */
ReviewSchema.index({ revieweeId: 1, createdAt: -1, _id: -1 });
