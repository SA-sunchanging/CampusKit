import { ApiProperty } from '@nestjs/swagger';
import {
  CATEGORIES,
  type Category,
  LISTING_STATUSES,
  type ListingStatus,
} from './listing-options.js';
import type { Listing } from './listing.entity.js';

/** An owner's listing card, without full photographs or administrator metadata. */
export class OwnerListingResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ enum: CATEGORIES })
  category: Category;

  @ApiProperty({ enum: LISTING_STATUSES })
  status: ListingStatus;

  @ApiProperty({ description: 'Satang per day.' })
  dailyRate: number;

  @ApiProperty({ type: String, nullable: true })
  thumbnail: string | null;

  @ApiProperty({ type: String, nullable: true })
  publishError: string | null;

  @ApiProperty({ type: String, nullable: true })
  rejectionReason: string | null;

  @ApiProperty()
  createdAt: Date;

  static of(listing: Listing): OwnerListingResponse {
    return Object.assign(new OwnerListingResponse(), {
      id: listing.id,
      title: listing.title,
      category: listing.category,
      status: listing.status,
      dailyRate: listing.dailyRate,
      thumbnail: listing.thumbnail,
      publishError: listing.publishError,
      rejectionReason: listing.rejectionReason,
      createdAt: listing.createdAt,
    });
  }
}

/** Body of GET /listings/mine, including the owner's listings in every status. */
export class OwnerListingsResponse {
  @ApiProperty({ type: [OwnerListingResponse] })
  items: OwnerListingResponse[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;
}
