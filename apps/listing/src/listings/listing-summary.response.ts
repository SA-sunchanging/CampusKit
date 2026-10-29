import { ApiProperty } from '@nestjs/swagger';
import type { OwnerReputation } from '../clients/review.client.js';
import {
  CATEGORIES,
  type Category,
  CONDITIONS,
  type Condition,
  PICKUP_LOCATIONS,
  type PickupLocation,
} from './listing-options.js';
import type { Listing } from './listing.entity.js';

/** A search result: only what a result card shows, with the small thumbnail, never the photos. */
export class ListingSummaryResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ enum: CATEGORIES })
  category: Category;

  @ApiProperty({ enum: CONDITIONS })
  condition: Condition;

  @ApiProperty({ description: 'Satang per day.' })
  dailyRate: number;

  @ApiProperty({ description: 'Satang.' })
  deposit: number;

  @ApiProperty({ enum: PICKUP_LOCATIONS, isArray: true })
  pickupLocations: PickupLocation[];

  @ApiProperty()
  ownerName: string;

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 4.5,
    description:
      "The owner's mean rating to one decimal; null without reviews or while Review is unavailable.",
  })
  ownerRating: number | null;

  @ApiProperty({
    description: 'Reviews of the owner; 0 while Review is unavailable.',
  })
  ownerReviewCount: number;

  @ApiProperty({ type: String, nullable: true })
  thumbnail: string | null;

  @ApiProperty()
  publishedAt: Date;

  static of(
    listing: Listing,
    reputation: OwnerReputation,
  ): ListingSummaryResponse {
    return Object.assign(new ListingSummaryResponse(), {
      id: listing.id,
      title: listing.title,
      category: listing.category,
      condition: listing.condition,
      dailyRate: listing.dailyRate,
      deposit: listing.deposit,
      pickupLocations: listing.pickupLocations,
      ownerName: listing.ownerName,
      ownerRating: reputation.ownerRating,
      ownerReviewCount: reputation.ownerReviewCount,
      thumbnail: listing.thumbnail,
      publishedAt: listing.publishedAt,
    });
  }
}

/** Body of GET /listings. */
export class SearchResultResponse {
  @ApiProperty({ type: [ListingSummaryResponse] })
  items: ListingSummaryResponse[];

  @ApiProperty({ description: 'Matching listings on all pages.' })
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;
}
