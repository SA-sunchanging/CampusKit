import { ApiProperty } from '@nestjs/swagger';
import {
  CATEGORIES,
  type Category,
  LISTING_STATUSES,
  type ListingStatus,
} from '../listings/listing-options.js';
import type { Listing } from '../listings/listing.entity.js';

/** A listing as the administrator's review queue shows it. Money is integer satang. */
export class ReviewItemResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  ownerId: string;

  @ApiProperty()
  ownerName: string;

  @ApiProperty({ enum: LISTING_STATUSES })
  status: ListingStatus;

  @ApiProperty()
  title: string;

  @ApiProperty({ enum: CATEGORIES })
  category: Category;

  @ApiProperty()
  description: string;

  @ApiProperty({ description: 'Satang.' })
  replacementValue: number;

  @ApiProperty({ description: 'Satang per day.' })
  dailyRate: number;

  @ApiProperty({ type: String, nullable: true })
  thumbnail: string | null;

  @ApiProperty({
    type: [String],
    description: 'Why the moderation rule held the listing for review.',
  })
  moderationFlags: string[];

  @ApiProperty({ type: String, nullable: true })
  rejectionReason: string | null;

  @ApiProperty({ type: Date, nullable: true })
  reviewedAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  static of(listing: Listing): ReviewItemResponse {
    return Object.assign(new ReviewItemResponse(), {
      id: listing.id,
      ownerId: listing.ownerId,
      ownerName: listing.ownerName,
      status: listing.status,
      title: listing.title,
      category: listing.category,
      description: listing.description,
      replacementValue: listing.replacementValue,
      dailyRate: listing.dailyRate,
      thumbnail: listing.thumbnail,
      moderationFlags: listing.moderationFlags,
      rejectionReason: listing.rejectionReason,
      reviewedAt: listing.reviewedAt,
      createdAt: listing.createdAt,
    });
  }
}

/** Body of GET /admin/listings. */
export class ReviewQueueResponse {
  @ApiProperty({ type: [ReviewItemResponse] })
  items: ReviewItemResponse[];

  @ApiProperty({ description: 'Matching listings on all pages.' })
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;
}
