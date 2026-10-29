import type { AuthUser } from '@app/common';
import { RENTAL_EVENTS } from '@app/contracts';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, type EntityManager } from 'typeorm';
import { BookingClient } from '../clients/booking.client.js';
import type { CallContext } from '../clients/call-context.js';
import { PaymentClient } from '../clients/payment.client.js';
import { checkCode } from './code-attempts.js';
import { lateCharge } from './late-fee.js';
import { lockForParty } from './rental-access.js';
import { announce } from './rental-events.js';
import { RentalResponse } from './rental.response.js';
import {
  findRental,
  RENTAL_COLUMNS,
  type RentalRow,
  updateRental,
} from './rental.row.js';
import { type StepProblem, stepProblem } from './step-failure.js';

/** Payment's operation ID for the settlement of a rental; the same on every retry. */
export function settleOperationId(rentalId: string): string {
  return `rental:${rentalId}:settle`;
}

const WRONG_CODE = 'WRONG_CODE';

/**
 * The owner confirms the return with the renter's code. The rental becomes SETTLEMENT_PENDING
 * with the late fee fixed; then Booking releases the dates and Payment settles the deposit, late
 * fee and payout, and the rental is CLOSED. When either call fails the rental stays
 * SETTLEMENT_PENDING with last_error, and the owner calls return again (no code needed) to retry
 * with the same operation IDs.
 */
@Injectable()
export class ReturnService {
  private readonly logger = new Logger(ReturnService.name);

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly booking: BookingClient,
    private readonly payment: PaymentClient,
  ) {}

  async confirmReturn(
    caller: AuthUser,
    id: string,
    code: string | undefined,
    call: CallContext,
    now = new Date(),
  ): Promise<RentalResponse> {
    const pending = await this.acceptReturn(caller, id, code, now);
    const problem =
      (await this.releaseCalendar(pending, call)) ??
      (await this.settle(pending, call));
    const row = problem
      ? await this.recordFailure(id, problem)
      : await this.close(id, call, now);
    return RentalResponse.of(row, caller.sub);
  }

  /** The rental in SETTLEMENT_PENDING: moved there now, or left there by an earlier attempt. */
  private async acceptReturn(
    caller: AuthUser,
    id: string,
    code: string | undefined,
    now: Date,
  ): Promise<RentalRow> {
    const result = await this.db.transaction(async (tx) => {
      const row = await lockForParty(
        tx,
        caller,
        id,
        'owner',
        'Only the owner can confirm the return',
      );
      switch (row.status) {
        case 'AWAITING_PICKUP':
          throw new ConflictException('The item has not been picked up yet');
        case 'CLOSED':
          throw new ConflictException('The rental is already closed');
        case 'SETTLEMENT_PENDING':
          // A retry: keep the stored return time and late fee, never recompute them.
          return row;
        case 'ACTIVE':
          return this.takeBack(tx, row, code, now);
      }
    });
    if (result === WRONG_CODE) {
      throw new BadRequestException('Wrong return code');
    }
    return result;
  }

  /**
   * Checks the return code of an ACTIVE rental and fixes the late fee. A wrong code is counted
   * and committed before the 400.
   */
  private async takeBack(
    tx: EntityManager,
    row: RentalRow,
    code: string | undefined,
    now: Date,
  ): Promise<RentalRow | typeof WRONG_CODE> {
    if (!code) {
      throw new BadRequestException('The return code is required');
    }
    const check = await checkCode(tx, row, 'return', code);
    if (check !== 'match') {
      if (check === 'replaced') {
        this.logger.warn(
          `Rental ${row.id}: too many wrong return codes, replaced`,
        );
      }
      return WRONG_CODE;
    }
    const { lateDays, lateFee } = lateCharge(row, now);
    return (await updateRental(
      tx,
      `UPDATE rentals
       SET status = 'SETTLEMENT_PENDING', returned_at = $2, late_days = $3,
           late_fee = $4, return_attempts = 0, updated_at = now()
       WHERE id = $1 AND status = 'ACTIVE'
       RETURNING ${RENTAL_COLUMNS}`,
      [row.id, now, lateDays, lateFee],
    )) as RentalRow;
  }

  private async releaseCalendar(
    rental: RentalRow,
    call: CallContext,
  ): Promise<StepProblem | undefined> {
    const result = await this.booking.releaseCalendar(rental.booking_id, call);
    return result.ok ? undefined : stepProblem('Calendar release', result);
  }

  private async settle(
    rental: RentalRow,
    call: CallContext,
  ): Promise<StepProblem | undefined> {
    const result = await this.payment.settle(
      {
        operationId: settleOperationId(rental.id),
        bookingId: rental.booking_id,
        deposit: rental.deposit,
        lateFee: rental.late_fee,
      },
      call,
    );
    return result.ok ? undefined : stepProblem('Settlement', result);
  }

  /** Keeps the reason with the SETTLEMENT_PENDING rental; the owner sees it and retries. */
  private async recordFailure(
    id: string,
    problem: StepProblem,
  ): Promise<RentalRow> {
    this.logger.warn(`Rental ${id} stays SETTLEMENT_PENDING: ${problem.text}`);
    const updated = await updateRental(
      this.db,
      `UPDATE rentals SET last_error = $2, updated_at = now()
       WHERE id = $1 AND status = 'SETTLEMENT_PENDING'
       RETURNING ${RENTAL_COLUMNS}`,
      [id, problem.text],
    );
    // undefined: a concurrent return closed the rental meanwhile.
    return updated ?? ((await findRental(this.db, id)) as RentalRow);
  }

  /**
   * SETTLEMENT_PENDING becomes CLOSED once, even when two returns race to this point; only the
   * return that made the change announces rental.closed, in the same transaction.
   */
  private async close(
    id: string,
    call: CallContext,
    now: Date,
  ): Promise<RentalRow> {
    const closed = await this.db.transaction(async (tx) => {
      const row = await updateRental(
        tx,
        `UPDATE rentals
         SET status = 'CLOSED', closed_at = $2, last_error = NULL, updated_at = now()
         WHERE id = $1 AND status = 'SETTLEMENT_PENDING'
         RETURNING ${RENTAL_COLUMNS}`,
        [id, now],
      );
      if (row) {
        await announce(tx, RENTAL_EVENTS.closed, row, call.correlationId);
      }
      return row;
    });
    if (!closed) {
      return (await findRental(this.db, id)) as RentalRow;
    }
    this.logger.log(`Rental ${id} is CLOSED`);
    return closed;
  }
}
