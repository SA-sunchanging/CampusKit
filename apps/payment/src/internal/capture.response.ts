import { ApiProperty } from '@nestjs/swagger';
import type { CaptureResult } from '../ledger/capture.js';

/** Reply of POST /internal/payments/capture. Money is integer satang. */
export class CaptureResponse {
  @ApiProperty({ format: 'uuid' })
  bookingId: string;

  @ApiProperty({ enum: ['FEE'] })
  kind: 'FEE';

  @ApiProperty({ description: 'Satang taken from the renter.' })
  capturedAmount: number;

  @ApiProperty({
    enum: ['CAPTURED', 'NOT_REQUIRED'],
    description:
      'NOT_REQUIRED when the booking has no fee and the amount is 0.',
  })
  status: 'CAPTURED' | 'NOT_REQUIRED';

  static of(result: CaptureResult): CaptureResponse {
    return Object.assign(new CaptureResponse(), {
      bookingId: result.bookingId,
      kind: result.kind,
      capturedAmount: result.capturedAmount,
      status: result.status,
    });
  }
}
