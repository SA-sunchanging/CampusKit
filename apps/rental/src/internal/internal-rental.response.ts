import { ApiProperty } from '@nestjs/swagger';
import {
  RENTAL_STATUSES,
  type RentalStatus,
} from '../rentals/rental.entity.js';
import type { RentalRow } from '../rentals/rental.row.js';

/** Reply of GET /internal/rentals/{id}: what Review needs to check who may review a rental. */
export class InternalRentalResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  bookingId: string;

  @ApiProperty({ format: 'uuid' })
  listingId: string;

  @ApiProperty({ format: 'uuid' })
  ownerId: string;

  @ApiProperty({ format: 'uuid' })
  renterId: string;

  @ApiProperty({ enum: RENTAL_STATUSES })
  status: RentalStatus;

  @ApiProperty({ description: 'ISO-8601 UTC; empty until CLOSED.' })
  closedAt: string;

  static of(row: RentalRow): InternalRentalResponse {
    return Object.assign(new InternalRentalResponse(), {
      id: row.id,
      bookingId: row.booking_id,
      listingId: row.listing_id,
      ownerId: row.owner_id,
      renterId: row.renter_id,
      status: row.status,
      closedAt: row.closed_at ? row.closed_at.toISOString() : '',
    });
  }
}
