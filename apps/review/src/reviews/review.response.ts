import { ApiProperty } from '@nestjs/swagger';
import {
  REVIEWER_ROLES,
  type ReviewerRole,
  type ReviewRecord,
} from './review.schema.js';

/** One review. createdAt is ISO-8601 UTC; comment is empty when the reviewer wrote none. */
export class ReviewResponse {
  @ApiProperty()
  id: string;

  @ApiProperty({ format: 'uuid' })
  rentalId: string;

  @ApiProperty({ format: 'uuid' })
  listingId: string;

  @ApiProperty({ format: 'uuid' })
  reviewerId: string;

  @ApiProperty({ format: 'uuid' })
  revieweeId: string;

  @ApiProperty({ enum: REVIEWER_ROLES, description: "The reviewer's side." })
  reviewerRole: ReviewerRole;

  @ApiProperty({ minimum: 1, maximum: 5 })
  rating: number;

  @ApiProperty({ description: 'Empty when the reviewer wrote none.' })
  comment: string;

  @ApiProperty({ example: '2026-10-29T08:00:00.000Z' })
  createdAt: string;

  static of(review: ReviewRecord): ReviewResponse {
    return Object.assign(new ReviewResponse(), {
      id: review._id.toString(),
      rentalId: review.rentalId,
      listingId: review.listingId,
      reviewerId: review.reviewerId,
      revieweeId: review.revieweeId,
      reviewerRole: review.reviewerRole,
      rating: review.rating,
      comment: review.comment ?? '',
      createdAt: review.createdAt.toISOString(),
    });
  }
}

/** Body of GET /reviews. */
export class ReceivedReviewsResponse {
  @ApiProperty({ type: [ReviewResponse], description: 'Newest first.' })
  items: ReviewResponse[];

  @ApiProperty({ description: 'Reviews the user received on all pages.' })
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;
}

/** Body of GET /reviews/rentals/{rentalId}. */
export class RentalReviewsResponse {
  @ApiProperty({
    type: [ReviewResponse],
    description:
      'At most two: the review the caller wrote and the one they received.',
  })
  items: ReviewResponse[];
}
