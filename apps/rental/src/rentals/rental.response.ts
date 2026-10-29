import { ApiProperty } from '@nestjs/swagger';
import { RENTAL_STATUSES, type RentalStatus } from './rental.entity.js';
import type { RentalRow } from './rental.row.js';

/** Whether two user IDs are the same person (UUIDs ignore case). */
export function samePerson(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/** The pickup code is shown only to the owner, and only while the rental awaits pickup. */
export function visiblePickupCode(row: RentalRow, viewerId: string): string {
  return samePerson(row.owner_id, viewerId) && row.status === 'AWAITING_PICKUP'
    ? row.pickup_code
    : '';
}

/** The return code is shown only to the renter, and only while the rental is active. */
export function visibleReturnCode(row: RentalRow, viewerId: string): string {
  return samePerson(row.renter_id, viewerId) && row.status === 'ACTIVE'
    ? row.return_code
    : '';
}

const iso = (time: Date | null): string => (time ? time.toISOString() : '');

/** A half-open period [start, end), ISO-8601 UTC. */
export class PeriodResponse {
  @ApiProperty({ example: '2026-11-01T17:00:00.000Z' })
  start: string;

  @ApiProperty({ example: '2026-11-04T17:00:00.000Z' })
  end: string;
}

/** The booking's terms. Money is integer satang. */
export class TermsResponse {
  @ApiProperty({ description: 'Satang, captured at pickup.', example: 6000 })
  rentalFee: number;

  @ApiProperty({
    description: 'Satang, settled after the return.',
    example: 30000,
  })
  deposit: number;

  @ApiProperty({ description: 'Satang per day late.', example: 4000 })
  lateFeePerDay: number;
}

/**
 * A rental as its renter or owner sees it. Every field is present: a time that is not set yet
 * is an empty string. Times are ISO-8601 UTC; money is integer satang.
 */
export class RentalResponse {
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

  @ApiProperty({ type: PeriodResponse })
  period: PeriodResponse;

  @ApiProperty({ type: TermsResponse })
  terms: TermsResponse;

  @ApiProperty({
    description:
      'Six digits, shown to the owner while AWAITING_PICKUP; empty otherwise. The owner gives it to the renter at pickup.',
  })
  pickupCode: string;

  @ApiProperty({
    description:
      'Six digits, shown to the renter while ACTIVE; empty otherwise. The renter gives it to the owner at the return.',
  })
  returnCode: string;

  @ApiProperty({ description: 'ISO-8601 UTC; empty before pickup.' })
  pickedUpAt: string;

  @ApiProperty({ description: 'ISO-8601 UTC; empty before the return.' })
  returnedAt: string;

  @ApiProperty({ description: 'ISO-8601 UTC; empty until CLOSED.' })
  closedAt: string;

  @ApiProperty({ description: 'Whole days late, set at the return.' })
  lateDays: number;

  @ApiProperty({ description: 'Satang, set at the return.' })
  lateFee: number;

  @ApiProperty({
    description: 'Why the last settlement attempt failed; empty otherwise.',
  })
  lastError: string;

  @ApiProperty({ description: 'ISO-8601 UTC.' })
  createdAt: string;

  @ApiProperty({ description: 'ISO-8601 UTC.' })
  updatedAt: string;

  static of(row: RentalRow, viewerId: string): RentalResponse {
    return Object.assign(new RentalResponse(), {
      id: row.id,
      bookingId: row.booking_id,
      listingId: row.listing_id,
      ownerId: row.owner_id,
      renterId: row.renter_id,
      status: row.status,
      period: {
        start: row.period_start.toISOString(),
        end: row.period_end.toISOString(),
      },
      terms: {
        rentalFee: row.rental_fee,
        deposit: row.deposit,
        lateFeePerDay: row.late_fee_per_day,
      },
      pickupCode: visiblePickupCode(row, viewerId),
      returnCode: visibleReturnCode(row, viewerId),
      pickedUpAt: iso(row.picked_up_at),
      returnedAt: iso(row.returned_at),
      closedAt: iso(row.closed_at),
      lateDays: row.late_days,
      lateFee: row.late_fee,
      lastError: row.last_error ?? '',
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    });
  }
}

/** Body of GET /rentals. */
export class RentalListResponse {
  @ApiProperty({ type: [RentalResponse], description: 'Newest first.' })
  rentals: RentalResponse[];

  static of(rows: RentalRow[], viewerId: string): RentalListResponse {
    return Object.assign(new RentalListResponse(), {
      rentals: rows.map((row) => RentalResponse.of(row, viewerId)),
    });
  }
}
