import { ApiProperty } from '@nestjs/swagger';
import {
  AUTHORIZATION_KINDS,
  AUTHORIZATION_STATUSES,
  type AuthorizationKind,
  type ReportedStatus,
} from '../ledger/authorization.entity.js';

/** All settled payouts to the caller, including rental fees and charged late fees. */
export class EarningsResponse {
  @ApiProperty({ description: 'All-time settled earnings, in integer satang.' })
  totalEarned: number;

  @ApiProperty({ description: 'Number of settled payouts to the caller.' })
  settledRentals: number;

  static of(value: {
    totalEarned: number;
    settledRentals: number;
  }): EarningsResponse {
    return Object.assign(new EarningsResponse(), value);
  }
}

/** One hold of a booking. Money is integer satang; times are ISO-8601 UTC. */
export class AuthorizationStatusResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: AUTHORIZATION_KINDS })
  kind: AuthorizationKind;

  @ApiProperty({ description: 'The amount held.' })
  amount: number;

  @ApiProperty({ description: 'Taken from the renter.' })
  capturedAmount: number;

  @ApiProperty({ description: 'Given back to the renter.' })
  releasedAmount: number;

  @ApiProperty({
    enum: [...AUTHORIZATION_STATUSES, 'EXPIRED'],
    description: 'EXPIRED: still AUTHORIZED but past expiresAt.',
  })
  status: ReportedStatus;

  @ApiProperty({ format: 'date-time' })
  expiresAt: string;
}

export class PayoutResponse {
  @ApiProperty({ description: 'Paid to the owner: fee plus late fee.' })
  amount: number;

  @ApiProperty({ format: 'uuid' })
  payeeId: string;

  @ApiProperty({ format: 'date-time' })
  paidAt: string;
}

/** Body of GET /payments/bookings/{bookingId}. */
export class PaymentStatusResponse {
  @ApiProperty({ format: 'uuid' })
  bookingId: string;

  @ApiProperty({
    type: [AuthorizationStatusResponse],
    description: 'FEE before DEPOSIT; empty when nothing is authorized.',
  })
  authorizations: AuthorizationStatusResponse[];

  @ApiProperty({
    type: PayoutResponse,
    nullable: true,
    description: 'Null until the rental is settled.',
  })
  payout: PayoutResponse | null;

  static of(value: {
    bookingId: string;
    authorizations: AuthorizationStatusResponse[];
    payout: PayoutResponse | null;
  }): PaymentStatusResponse {
    return Object.assign(new PaymentStatusResponse(), value);
  }
}
