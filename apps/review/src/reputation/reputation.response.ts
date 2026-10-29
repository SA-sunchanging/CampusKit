import { ApiProperty } from '@nestjs/swagger';

/** How one user was rated by the people they rented with. */
export class ReputationResponse {
  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 4.5,
    description: 'Mean rating rounded to one decimal; null without reviews.',
  })
  averageRating: number | null;

  @ApiProperty()
  reviewCount: number;

  static of(
    userId: string,
    ratingSum: number,
    reviewCount: number,
  ): ReputationResponse {
    return Object.assign(new ReputationResponse(), {
      userId,
      averageRating: averageRating(ratingSum, reviewCount),
      reviewCount,
    });
  }
}

/** Body of GET /internal/reputation: one item per requested user, in the order asked. */
export class ReputationListResponse {
  @ApiProperty({ type: [ReputationResponse] })
  items: ReputationResponse[];
}

/**
 * The mean rating rounded half up to one decimal, or null without reviews. Rounds sum * 10 /
 * count rather than the mean, so 4.35 (87 / 20) becomes 4.4 despite floating point.
 */
export function averageRating(sum: number, count: number): number | null {
  return count === 0 ? null : Math.round((sum * 10) / count) / 10;
}
