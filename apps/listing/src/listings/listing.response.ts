import { ApiProperty } from '@nestjs/swagger';
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

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ type: Date, nullable: true })
  publishedAt: Date | null;

  static of(listing: Listing, photos: string[]): ListingResponse {
    return Object.assign(new ListingResponse(), {
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
      createdAt: listing.createdAt,
      publishedAt: listing.publishedAt,
    });
  }
}
