import { ConflictException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, type EntityManager } from 'typeorm';
import { SettleResponse } from '../internal/settle.response.js';
import {
  type AuthorizationRow,
  ofKind,
  reportedStatus,
} from './authorization.row.js';
import { type OperationRequest, runOperation } from './operations.js';

/** Body of POST /internal/payments/settle. Money is integer satang. */
export interface SettleRequest extends OperationRequest {
  /** The booking's deposit; must equal the deposit authorization, or be 0 when there is none. */
  deposit: number;
  /** The late fee Rental computed at the return. */
  lateFee: number;
}

export interface SettleResult {
  bookingId: string;
  /** The late fee taken from the deposit: min(lateFee, deposit). */
  lateFeeCharged: number;
  /** The rest of the deposit, given back to the renter. */
  depositReleased: number;
  /** What the owner receives: the captured fee plus the late fee charged. */
  payout: number;
}

/** Throws 409 unless the fee, when the booking has one, was captured at pickup. */
function checkFee(fee: AuthorizationRow | undefined, now: Date): void {
  if (fee && fee.status !== 'CAPTURED') {
    throw new ConflictException(
      `The fee authorization is ${reportedStatus(fee, now)}, not CAPTURED`,
    );
  }
}

/** Throws 409 unless the deposit authorization matches the deposit and can be settled now. */
function checkDeposit(
  row: AuthorizationRow | undefined,
  deposit: number,
  now: Date,
): void {
  if (!row) {
    if (deposit > 0) {
      throw new ConflictException('The booking has no deposit authorization');
    }
    return;
  }
  const status = reportedStatus(row, now);
  if (status === 'EXPIRED') {
    throw new ConflictException('The deposit authorization has expired');
  }
  if (status !== 'AUTHORIZED') {
    throw new ConflictException(`The deposit authorization is ${status}`);
  }
  if (row.amount !== deposit) {
    throw new ConflictException(
      `The deposit ${deposit} does not match the deposit authorization of ${row.amount}`,
    );
  }
}

/**
 * Closes the money side of a returned rental (called by Rental): the late fee is taken from the
 * deposit, capped at the deposit, the rest of the deposit is released, and the owner is paid
 * the captured fee plus the late fee taken. There is no charge beyond the deposit.
 */
@Injectable()
export class SettleService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async settle(
    request: SettleRequest,
    now = new Date(),
  ): Promise<SettleResponse> {
    const result = await runOperation(this.db, 'SETTLE', request, (tx, rows) =>
      this.apply(tx, rows, request, now),
    );
    return SettleResponse.of(result);
  }

  private async apply(
    tx: EntityManager,
    rows: AuthorizationRow[],
    request: SettleRequest,
    now: Date,
  ): Promise<SettleResult> {
    await refuseSecondSettlement(tx, request.bookingId);
    const fee = ofKind(rows, 'FEE');
    const deposit = ofKind(rows, 'DEPOSIT');
    checkFee(fee, now);
    checkDeposit(deposit, request.deposit, now);
    const taken = Math.min(request.lateFee, request.deposit);
    if (deposit) {
      await tx.query(
        `UPDATE authorizations
         SET status = 'SETTLED', captured_amount = $2, released_amount = $3,
             updated_at = now()
         WHERE id = $1 AND status = 'AUTHORIZED'`,
        [deposit.id, taken, request.deposit - taken],
      );
    }
    const payout = (fee?.captured_amount ?? 0) + taken;
    const payee = (fee ?? deposit)?.payee_id;
    // A booking without any authorization has nobody to pay and records no payout.
    if (payee) {
      await tx.query(
        `INSERT INTO payouts (booking_id, payee_id, amount, paid_at)
         VALUES ($1, $2, $3, $4)`,
        [request.bookingId, payee, payout, now],
      );
    }
    return {
      bookingId: request.bookingId,
      lateFeeCharged: taken,
      depositReleased: request.deposit - taken,
      payout,
    };
  }
}

/** A booking is settled once; a new operation ID after that answers 409. */
async function refuseSecondSettlement(
  tx: EntityManager,
  bookingId: string,
): Promise<void> {
  const paid = (await tx.query(`SELECT 1 FROM payouts WHERE booking_id = $1`, [
    bookingId,
  ])) as unknown[];
  if (paid.length > 0) {
    throw new ConflictException('The booking is already settled');
  }
}
