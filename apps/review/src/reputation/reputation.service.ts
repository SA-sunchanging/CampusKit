import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Review } from '../reviews/review.schema.js';
import { ReputationResponse } from './reputation.response.js';

interface RatingTotals {
  /** The reviewee's user ID. */
  _id: string;
  sum: number;
  count: number;
}

/** Reputation summaries computed from the reviews each user received. */
@Injectable()
export class ReputationService {
  constructor(
    @InjectModel(Review.name) private readonly reviews: Model<Review>,
  ) {}

  /**
   * One summary per distinct user ID, in the order given, from a single aggregation. A user
   * without reviews gets averageRating null and reviewCount 0.
   */
  async summaries(userIds: string[]): Promise<ReputationResponse[]> {
    const ids = [...new Set(userIds.map((id) => id.toLowerCase()))];
    const totals = await this.reviews
      .aggregate<RatingTotals>([
        { $match: { revieweeId: { $in: ids } } },
        {
          $group: {
            _id: '$revieweeId',
            sum: { $sum: '$rating' },
            count: { $sum: 1 },
          },
        },
      ])
      .exec();
    const byId = new Map(totals.map((row) => [row._id, row]));
    return ids.map((id) => {
      const row = byId.get(id);
      return ReputationResponse.of(id, row?.sum ?? 0, row?.count ?? 0);
    });
  }

  async summary(userId: string): Promise<ReputationResponse> {
    const [summary] = await this.summaries([userId]);
    return summary;
  }
}
