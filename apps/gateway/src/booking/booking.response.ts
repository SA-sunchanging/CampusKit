import { ApiProperty } from '@nestjs/swagger';
import { BOOKING_STATUSES, type BookingStatus } from './booking-status.js';

/** A half-open period [start, end), ISO-8601 UTC. */
export class DateRangeResponse {
  @ApiProperty({ example: '2026-11-01T17:00:00.000Z' })
  start: string;

  @ApiProperty({ example: '2026-11-04T17:00:00.000Z' })
  end: string;
}

/** Terms copied from the Listing quote when the request was made. Money is integer satang. */
export class TermsResponse {
  @ApiProperty({ description: 'Satang: daily rate times days.', example: 6000 })
  rentalFee: number;

  @ApiProperty({ description: 'Satang.', example: 30000 })
  deposit: number;

  @ApiProperty({ description: 'Satang per day late.', example: 4000 })
  lateFeePerDay: number;
}

export class BookingResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  listingId: string;

  @ApiProperty({ format: 'uuid' })
  renterId: string;

  @ApiProperty({ format: 'uuid' })
  ownerId: string;

  @ApiProperty({ enum: BOOKING_STATUSES })
  status: BookingStatus;

  @ApiProperty({ type: DateRangeResponse })
  period: DateRangeResponse;

  @ApiProperty({ type: TermsResponse })
  terms: TermsResponse;

  @ApiProperty({ description: 'Set when DECLINED; empty otherwise.' })
  declineReason: string;

  @ApiProperty({
    description: 'ISO-8601 UTC. A PENDING request expires at this time.',
  })
  expiresAt: string;

  @ApiProperty({ description: 'ISO-8601 UTC.' })
  createdAt: string;

  @ApiProperty({ description: 'ISO-8601 UTC.' })
  updatedAt: string;
}

export class BookingListResponse {
  @ApiProperty({ type: [BookingResponse], description: 'Newest first.' })
  bookings: BookingResponse[];
}

export class AvailabilityResponse {
  @ApiProperty({
    description:
      'Advisory: the request rechecks the dates when it reserves them.',
  })
  available: boolean;
}
