import { ApiProperty } from '@nestjs/swagger';
import {
  RENTAL_STATUSES,
  type RentalStatus,
} from '../rentals/rental.entity.js';
import type { RentalRow } from '../rentals/rental.row.js';

/** Reply of POST /internal/rentals. Booking needs only the id. */
export class CreateRentalResponse {
  @ApiProperty({ format: 'uuid', description: 'The rental.' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  bookingId: string;

  @ApiProperty({ enum: RENTAL_STATUSES, example: 'AWAITING_PICKUP' })
  status: RentalStatus;

  static of(row: RentalRow): CreateRentalResponse {
    return Object.assign(new CreateRentalResponse(), {
      id: row.id,
      bookingId: row.booking_id,
      status: row.status,
    });
  }
}
