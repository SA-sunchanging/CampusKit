import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { InternalRentalResponse } from '../internal/internal-rental.response.js';
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
   * can retry. Answers 404 when the booking has no rental and 409 once the item is picked up.
   * Rental announces nothing: Booking tells both people that the booking was cancelled.
   */
  async cancelByBooking(bookingId: string): Promise<InternalRentalResponse> {
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
      return (await updateRental(
        tx,
        `UPDATE rentals SET status = 'CANCELLED', updated_at = now()
         WHERE id = $1 AND status = 'AWAITING_PICKUP'
         RETURNING ${RENTAL_COLUMNS}`,
        [rental.id],
      )) as RentalRow;
    });
    this.logger.log(`Rental ${row.id} of booking ${bookingId} is CANCELLED`);
    return InternalRentalResponse.of(row);
  }
}
