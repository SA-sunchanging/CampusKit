import { ApiProperty } from '@nestjs/swagger';
import type { SettleResult } from '../ledger/settle.js';

/** Reply of POST /internal/payments/settle. Money is integer satang. */
export class SettleResponse {
  @ApiProperty({ format: 'uuid' })
  bookingId: string;

  @ApiProperty({ description: 'The late fee taken from the deposit.' })
  lateFeeCharged: number;

  @ApiProperty({ description: 'The rest of the deposit, given back.' })
  depositReleased: number;

  @ApiProperty({
    description: 'Paid to the owner: the captured fee plus the late fee.',
  })
  payout: number;

  static of(result: SettleResult): SettleResponse {
    return Object.assign(new SettleResponse(), {
      bookingId: result.bookingId,
      lateFeeCharged: result.lateFeeCharged,
      depositReleased: result.depositReleased,
      payout: result.payout,
    });
  }
}
