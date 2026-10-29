import { ApiProperty } from '@nestjs/swagger';
import {
  AUTHORIZATION_KINDS,
  type AuthorizationKind,
} from '../ledger/authorization.entity.js';
import type { VoidResult } from '../ledger/void.js';

/** Reply of POST /internal/payments/void. */
export class VoidResponse {
  @ApiProperty({ format: 'uuid' })
  bookingId: string;

  @ApiProperty({
    enum: AUTHORIZATION_KINDS,
    isArray: true,
    description: 'The holds this operation released, FEE before DEPOSIT.',
  })
  voided: AuthorizationKind[];

  static of(result: VoidResult): VoidResponse {
    return Object.assign(new VoidResponse(), {
      bookingId: result.bookingId,
      voided: [...result.voided],
    });
  }
}
