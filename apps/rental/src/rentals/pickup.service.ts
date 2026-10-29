import type { AuthUser } from '@app/common';
import { RENTAL_EVENTS } from '@app/contracts';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BookingClient } from '../clients/booking.client.js';
import type { CallContext } from '../clients/call-context.js';
import { PaymentClient } from '../clients/payment.client.js';
import { checkCode } from './code-attempts.js';
import { bookingProblem, pickupWindowError } from './pickup-checks.js';
import { claimPickup, hasFreshClaim } from './pickup-claim.js';
import { lockForParty } from './rental-access.js';
import { announce } from './rental-events.js';
import { RentalResponse } from './rental.response.js';
import {
  findRental,
  RENTAL_COLUMNS,
  type RentalRow,
  updateRental,
} from './rental.row.js';
import {
  conflictProblem,
  type StepProblem,
  stepProblem,
} from './step-failure.js';

/** Payment's operation ID for the fee capture of a rental; the same on every retry. */
export function captureOperationId(rentalId: string): string {
  return `rental:${rentalId}:capture-fee`;
}

const WRONG_CODE = 'WRONG_CODE';

const CANCELLED_MESSAGE = 'The booking was cancelled, so there is no pickup';

/**
 * The renter confirms pickup with the owner's code. The rental becomes ACTIVE once Booking
 * still shows the booking CONFIRMED for the same people and period and Payment has captured
 * the fee. Until then it stays AWAITING_PICKUP and the code stays valid.
 */
@Injectable()
export class PickupService {
  private readonly logger = new Logger(PickupService.name);

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly booking: BookingClient,
    private readonly payment: PaymentClient,
  ) {}

  async pickup(
    caller: AuthUser,
    id: string,
    code: string,
    call: CallContext,
    now = new Date(),
  ): Promise<RentalResponse> {
    const rental = await this.checkHandover(caller, id, code, now);
    const problem =
      (await this.recheckBooking(rental, call)) ??
      (await this.captureFee(rental, call));
    if (problem) {
      this.logger.warn(`Rental ${id} stays AWAITING_PICKUP: ${problem.text}`);
      await this.recordFailure(id, problem.text);
      throw problem.exception;
    }
    return RentalResponse.of(await this.activate(id, call, now), caller.sub);
  }

  /**
   * Checks the status, the pickup window and the code on the locked row, then claims the
   * rental so a cancellation waits until this pickup ends. A wrong code is committed with its
   * counter before the 400, so retrying cannot undo the attempt.
   */
  private async checkHandover(
    caller: AuthUser,
    id: string,
    code: string,
    now: Date,
  ): Promise<RentalRow> {
    const result = await this.db.transaction(async (tx) => {
      const row = await lockForParty(
        tx,
        caller,
        id,
        'renter',
        'Only the renter can confirm the pickup',
      );
      if (row.status === 'CANCELLED') {
        throw new ConflictException(CANCELLED_MESSAGE);
      }
      if (row.status !== 'AWAITING_PICKUP') {
        throw new ConflictException('The item was already picked up');
      }
      if (hasFreshClaim(row, now)) {
        throw new ConflictException(
          'A pickup of this rental is already in progress; try again in a moment',
        );
      }
      const windowError = pickupWindowError(row, now);
      if (windowError) {
        throw new ConflictException(windowError);
      }
      const check = await checkCode(tx, row, 'pickup', code);
      if (check === 'replaced') {
        this.logger.warn(`Rental ${id}: too many wrong pickup codes, replaced`);
      }
      if (check !== 'match') {
        return WRONG_CODE;
      }
      // The row is locked and unclaimed, so the claim succeeds.
      return (await claimPickup(tx, id, now)) as RentalRow;
    });
    if (result === WRONG_CODE) {
      throw new BadRequestException('Wrong pickup code');
    }
    return result;
  }

  private async recheckBooking(
    rental: RentalRow,
    call: CallContext,
  ): Promise<StepProblem | undefined> {
    const result = await this.booking.getBooking(rental.booking_id, call);
    if (!result.ok) {
      return stepProblem('Booking check', result);
    }
    const problem = bookingProblem(rental, result.value);
    return problem ? conflictProblem(problem) : undefined;
  }

  private async captureFee(
    rental: RentalRow,
    call: CallContext,
  ): Promise<StepProblem | undefined> {
    const result = await this.payment.capture(
      {
        operationId: captureOperationId(rental.id),
        bookingId: rental.booking_id,
        amount: rental.rental_fee,
      },
      call,
    );
    return result.ok ? undefined : stepProblem('Fee capture', result);
  }

  /**
   * Keeps the reason for the page while the rental still awaits pickup, and drops the claim
   * so the booking can be cancelled again.
   */
  private async recordFailure(id: string, text: string): Promise<void> {
    await updateRental(
      this.db,
      `UPDATE rentals SET last_error = $2, pickup_claimed_at = NULL, updated_at = now()
       WHERE id = $1 AND status = 'AWAITING_PICKUP'
       RETURNING ${RENTAL_COLUMNS}`,
      [id, text],
    );
  }

  /**
   * AWAITING_PICKUP becomes ACTIVE once, even when two pickups race to this point; only the
   * pickup that made the change announces rental.started, in the same transaction.
   */
  private async activate(
    id: string,
    call: CallContext,
    now: Date,
  ): Promise<RentalRow> {
    const active = await this.db.transaction(async (tx) => {
      const row = await updateRental(
        tx,
        `UPDATE rentals
         SET status = 'ACTIVE', picked_up_at = $2, pickup_attempts = 0,
             last_error = NULL, pickup_claimed_at = NULL, updated_at = now()
         WHERE id = $1 AND status = 'AWAITING_PICKUP'
         RETURNING ${RENTAL_COLUMNS}`,
        [id, now],
      );
      if (row) {
        await announce(tx, RENTAL_EVENTS.started, row, call.correlationId);
      }
      return row;
    });
    if (!active) {
      // A concurrent pickup whose claim had lapsed won (the capture was idempotent), or a
      // cancellation ended the rental after this pickup's claim lapsed.
      const current = (await findRental(this.db, id)) as RentalRow;
      if (current.status === 'CANCELLED') {
        throw new ConflictException(CANCELLED_MESSAGE);
      }
      return current;
    }
    this.logger.log(`Rental ${id} is ACTIVE`);
    return active;
  }
}
