import type { AuthUser } from '@app/common';
import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  type AuthorizationRow,
  findAuthorizations,
  reportedStatus,
} from '../ledger/authorization.row.js';
import {
  type AuthorizationStatusResponse,
  EarningsResponse,
  PaymentStatusResponse,
  type PayoutResponse,
} from './payment-status.response.js';

interface EarningsRow {
  total_earned: string;
  settled_rentals: number;
}

interface PayoutRow {
  amount: number;
  payee_id: string;
  paid_at: Date;
}

function toAuthorization(
  row: AuthorizationRow,
  now: Date,
): AuthorizationStatusResponse {
  return {
    id: row.id,
    kind: row.kind,
    amount: row.amount,
    capturedAmount: row.captured_amount,
    releasedAmount: row.released_amount,
    status: reportedStatus(row, now),
    expiresAt: row.expires_at.toISOString(),
  };
}

/** Read side of Payment: a booking's payments and the caller's settled earnings. */
@Injectable()
export class PaymentStatusService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async earnings(caller: AuthUser): Promise<EarningsResponse> {
    if (caller.role !== 'student') {
      throw new ForbiddenException('Only students can view rental earnings');
    }
    const [row] = (await this.db.query(
      `SELECT COALESCE(SUM(amount), 0)::text AS total_earned,
              COUNT(*)::int AS settled_rentals
       FROM payouts WHERE payee_id = $1`,
      [caller.sub],
    )) as EarningsRow[];
    const totalEarned = Number(row.total_earned);
    if (!Number.isSafeInteger(totalEarned) || totalEarned < 0) {
      throw new InternalServerErrorException(
        'Earnings total is outside the supported range',
      );
    }
    return EarningsResponse.of({
      totalEarned,
      settledRentals: row.settled_rentals,
    });
  }

  /**
   * The payment status of a booking for its renter (payer) or owner (payee); anyone else gets
   * 404. A booking with nothing authorized yet answers an empty list, since Payment cannot tell
   * who takes part in it.
   */
  async forBooking(
    caller: AuthUser,
    bookingId: string,
    now = new Date(),
  ): Promise<PaymentStatusResponse> {
    const rows = await findAuthorizations(this.db, bookingId);
    if (rows.length === 0) {
      return PaymentStatusResponse.of({
        bookingId,
        authorizations: [],
        payout: null,
      });
    }
    if (
      !rows.some(
        (row) => row.payer_id === caller.sub || row.payee_id === caller.sub,
      )
    ) {
      throw new NotFoundException('Payment not found');
    }
    const [payout] = (await this.db.query(
      `SELECT amount, payee_id, paid_at FROM payouts WHERE booking_id = $1`,
      [bookingId],
    )) as PayoutRow[];
    return PaymentStatusResponse.of({
      bookingId,
      authorizations: rows.map((row) => toAuthorization(row, now)),
      payout: payout ? toPayout(payout) : null,
    });
  }
}

function toPayout(row: PayoutRow): PayoutResponse {
  return {
    amount: row.amount,
    payeeId: row.payee_id,
    paidAt: row.paid_at.toISOString(),
  };
}
