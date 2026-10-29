import type { AuthUser } from '@app/common';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { ReputationService } from '../reputation/reputation.service.js';
import type { ReceivedReviewsQuery } from './dto/received-reviews.query.js';
import {
  ReceivedReviewsResponse,
  RentalReviewsResponse,
  ReviewResponse,
} from './review.response.js';
import { Review, type ReviewRecord } from './review.schema.js';

/** Read side of Review. Reviews are public to signed-in users, as on a profile page. */
@Injectable()
export class ReviewQueriesService {
  constructor(
    @InjectModel(Review.name) private readonly reviews: Model<Review>,
    private readonly reputation: ReputationService,
  ) {}

  /** The reviews a user received, newest first, with the count and mean of all of them. */
  async received(
    query: ReceivedReviewsQuery,
  ): Promise<ReceivedReviewsResponse> {
    const [rows, summary] = await Promise.all([
      this.reviews
        .find({ revieweeId: query.userId.toLowerCase() })
        .sort({ createdAt: -1, _id: -1 })
        .skip((query.page - 1) * query.pageSize)
        .limit(query.pageSize)
        .lean<ReviewRecord[]>()
        .exec(),
      this.reputation.summary(query.userId),
    ]);
    return Object.assign(new ReceivedReviewsResponse(), {
      items: rows.map((row) => ReviewResponse.of(row)),
      total: summary.reviewCount,
      averageRating: summary.averageRating,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  /**
   * The reviews of one rental that the caller wrote or received, so a participant can see
   * whether they reviewed it. Anyone else gets an empty list.
   */
  async ofRental(
    caller: AuthUser,
    rentalId: string,
  ): Promise<RentalReviewsResponse> {
    const callerId = caller.sub.toLowerCase();
    const rows = await this.reviews
      .find({
        rentalId: rentalId.toLowerCase(),
        $or: [{ reviewerId: callerId }, { revieweeId: callerId }],
      })
      .sort({ createdAt: 1, _id: 1 })
      .lean<ReviewRecord[]>()
      .exec();
    return Object.assign(new RentalReviewsResponse(), {
      items: rows.map((row) => ReviewResponse.of(row)),
    });
  }
}
