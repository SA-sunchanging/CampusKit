import type { AuthUser } from '@app/common';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { RentalClient, type RentalView } from '../clients/rental.client.js';
import type { SubmitReviewDto } from './dto/submit-review.dto.js';
import { ReviewResponse } from './review.response.js';
import { Review, type ReviewRecord } from './review.schema.js';

/** MongoDB's error code for a unique index violation. */
const DUPLICATE_KEY = 11000;

function isDuplicateKey(error: unknown): boolean {
  return (error as { code?: unknown } | undefined)?.code === DUPLICATE_KEY;
}

/**
 * The caller's side of the rental and the other participant. Throws 403 when the caller took
 * no part in it.
 */
export function sidesOf(
  rental: RentalView,
  callerId: string,
): Pick<Review, 'reviewerRole' | 'revieweeId'> {
  if (rental.ownerId.toLowerCase() === callerId) {
    return { reviewerRole: 'owner', revieweeId: rental.renterId.toLowerCase() };
  }
  if (rental.renterId.toLowerCase() === callerId) {
    return { reviewerRole: 'renter', revieweeId: rental.ownerId.toLowerCase() };
  }
  throw new ForbiddenException(
    'Only the owner and the renter can review a rental',
  );
}

/** Write side of Review: a participant reviews the other once a rental is CLOSED. */
@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(Review.name) private readonly reviews: Model<Review>,
    private readonly rentals: RentalClient,
  ) {}

  /**
   * Stores the caller's review of the other participant. 404 for an unknown rental, 403 for a
   * caller outside it, 409 before the rental is CLOSED or when the caller already reviewed it.
   */
  async submit(
    caller: AuthUser,
    dto: SubmitReviewDto,
    correlationId: string,
  ): Promise<ReviewResponse> {
    const rental = await this.rentals.get(dto.rentalId, correlationId);
    const sides = sidesOf(rental, caller.sub.toLowerCase());
    if (rental.status !== 'CLOSED') {
      throw new ConflictException(
        'You can review a rental only after it is closed',
      );
    }
    try {
      const created = await this.reviews.create({
        rentalId: rental.id.toLowerCase(),
        listingId: rental.listingId.toLowerCase(),
        reviewerId: caller.sub.toLowerCase(),
        ...sides,
        rating: dto.rating,
        comment: dto.comment,
      });
      return ReviewResponse.of(created.toObject<ReviewRecord>());
    } catch (error) {
      if (isDuplicateKey(error)) {
        throw new ConflictException('You already reviewed this rental');
      }
      throw error;
    }
  }
}
