import { ApiProperty } from '@nestjs/swagger';
import { AUTHORIZATION_STATUSES } from '../ledger/authorization.entity.js';

/** Reply of POST /internal/payments/authorize, the shape Booking expects. */
export class AuthorizeResponse {
  @ApiProperty({ format: 'uuid', description: 'The authorization.' })
  id: string;

  @ApiProperty({ enum: AUTHORIZATION_STATUSES, example: 'AUTHORIZED' })
  status: string;

  static of(value: { id: string; status: string }): AuthorizeResponse {
    return Object.assign(new AuthorizeResponse(), {
      id: value.id,
      status: value.status,
    });
  }
}
