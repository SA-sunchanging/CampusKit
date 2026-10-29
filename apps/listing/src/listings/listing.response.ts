import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { OwnerReputation } from '../clients/review.client.js';
import {
  CATEGORIES,
  type Category,
  CONDITIONS,
  type Condition,
  LISTING_STATUSES,
  type ListingStatus,
  PICKUP_LOCATIONS,
  type PickupLocation,
} from './listing-options.js';
import type { Listing } from './listing.entity.js';

export class BlackoutResponse {
  @ApiProperty({ example: '2026-11-01T17:00:00.000Z' })
  start: string;

  @ApiProperty({ example: '2026-11-03T17:00:00.000Z' })
  end: string;
}

/** A listing as the detail page shows it. Money is integer satang. */
export class ListingResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  ownerId: string;

  @ApiProperty()
  ownerName: string;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    example: 4.5,
    description:
      "Only on GET /listings/{id}: the owner's mean rating to one decimal; null without reviews or while Review is unavailable.",
  })
  ownerRating?: number | null;

  @ApiPropertyOptional({
    description:
      'Only on GET /listings/{id}: reviews of the owner; 0 while Review is unavailable.',
  })
  ownerReviewCount?: number;

  @ApiProperty({ enum: LISTING_STATUSES })
  status: ListingStatus;

  @ApiProperty()
  title: string;

  @ApiProperty({ enum: CATEGORIES })
  category: Category;

  @ApiProperty()
  description: string;

  @ApiProperty({ enum: CONDITIONS })
  condition: Condition;

  @ApiProperty({ type: [String] })
  accessories: string[];

  @ApiProperty()
  replacementValue: number;

  @ApiProperty()
  dailyRate: number;

  @ApiProperty()
  deposit: number;

  @ApiProperty()
  lateFeePerDay: number;

  @ApiProperty()
  maxRentalDays: number;

  @ApiProperty({ enum: PICKUP_LOCATIONS, isArray: true })
  pickupLocations: PickupLocation[];

  @ApiProperty({ type: [BlackoutResponse] })
  blackouts: BlackoutResponse[];

  @ApiProperty({
    type: [String],
    description: 'Data URLs; the first is the cover.',
  })
  photos: string[];

  @ApiProperty({ type: String, nullable: true })
  thumbnail: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Why the last publish attempt failed. Set only on a DRAFT.',
  })
  publishError: string | null;

  @ApiProperty({
    type: [String],
    description:
      'Why the moderation rule held the listing for review; empty when it was not held.',
  })
  moderationFlags: string[];

  @ApiProperty({
    type: String,
    nullable: true,
    description: "The administrator's reason. Set only on a REJECTED listing.",
  })
  rejectionReason: string | null;

  @ApiProperty({ type: Date, nullable: true })
  reviewedAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({
    type: Date,
    nullable: true,
    description:
      'When the listing was first published; kept after it is unpublished.',
  })
  publishedAt: Date | null;

  @ApiProperty({ type: Date, nullable: true })
  unpublishedAt: Date | null;

  /** The owner's reputation is added only for the detail page. */
  static of(
    listing: Listing,
    photos: string[],
    reputation?: OwnerReputation,
  ): ListingResponse {
    return Object.assign(new ListingResponse(), {
      ...reputation,
      id: listing.id,
      ownerId: listing.ownerId,
      ownerName: listing.ownerName,
      status: listing.status,
      title: listing.title,
      category: listing.category,
      description: listing.description,
      condition: listing.condition,
      accessories: listing.accessories,
      replacementValue: listing.replacementValue,
      dailyRate: listing.dailyRate,
      deposit: listing.deposit,
      lateFeePerDay: listing.lateFeePerDay,
      maxRentalDays: listing.maxRentalDays,
      pickupLocations: listing.pickupLocations,
      blackouts: listing.blackouts,
      photos,
      thumbnail: listing.thumbnail,
      publishError: listing.publishError,
      moderationFlags: listing.moderationFlags,
      rejectionReason: listing.rejectionReason,
      reviewedAt: listing.reviewedAt,
      createdAt: listing.createdAt,
      publishedAt: listing.publishedAt,
      unpublishedAt: listing.unpublishedAt,
    });
  }
}
