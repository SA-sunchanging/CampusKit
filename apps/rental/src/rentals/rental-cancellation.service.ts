import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { InternalRentalResponse } from '../internal/internal-rental.response.js';
import { claimLapsedAt, hasFreshClaim } from './pickup-claim.js';
import {
  findRentalByBooking,
  RENTAL_COLUMNS,
  type RentalRow,
  updateRental,
} from './rental.row.js';

/** Ends the rental of a booking that Booking cancels before pickup. */
@Injectable()
export class RentalCancellationService {
  private readonly logger = new Logger(RentalCancellationService.name);

  constructor(@InjectDataSource() private readonly db: DataSource) {}

  /**
   * AWAITING_PICKUP becomes CANCELLED; a CANCELLED rental is returned unchanged, so Booking
   * can retry. Answers 404 when the booking has no rental, and 409 once the item is picked up
   * or while a pickup holds a fresh claim (it may be capturing the fee).
   * Rental announces nothing: Booking tells both people that the booking was cancelled.
   */
  async cancelByBooking(
    bookingId: string,
    now = new Date(),
  ): Promise<InternalRentalResponse> {
    const row = await this.db.transaction(async (tx) => {
      const rental = await findRentalByBooking(tx, bookingId, true);
      if (!rental) {
        throw new NotFoundException('The booking has no rental');
      }
      if (rental.status === 'CANCELLED') {
        return rental;
      }
      if (rental.status !== 'AWAITING_PICKUP') {
        throw new ConflictException(
          'The item was already picked up, so the rental cannot be cancelled',
        );
      }
      if (hasFreshClaim(rental, now)) {
        throw new ConflictException(
          'The item is being picked up, so the rental cannot be cancelled',
        );
      }
      // The row is locked and unclaimed, so the update succeeds.
      return (await updateRental(
        tx,
        `UPDATE rentals SET status = 'CANCELLED', updated_at = now()
         WHERE id = $1 AND status = 'AWAITING_PICKUP'
           AND (pickup_claimed_at IS NULL OR pickup_claimed_at <= $2)
         RETURNING ${RENTAL_COLUMNS}`,
        [rental.id, claimLapsedAt(now)],
      )) as RentalRow;
    });
    this.logger.log(`Rental ${row.id} of booking ${bookingId} is CANCELLED`);
    return InternalRentalResponse.of(row);
  }
}
