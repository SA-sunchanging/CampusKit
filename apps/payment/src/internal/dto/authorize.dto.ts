import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsUUID, Max, Min } from 'class-validator';
import {
  AUTHORIZATION_KINDS,
  type AuthorizationKind,
} from '../../ledger/authorization.entity.js';
import type { AuthorizeRequest } from '../../ledger/authorize.js';
import { MAX_SATANG, OperationDto } from './operation.dto.js';

/** Body of POST /internal/payments/authorize. Money is integer satang. */
export class AuthorizeDto extends OperationDto implements AuthorizeRequest {
  @ApiProperty({ format: 'uuid', description: 'The renter.' })
  @IsUUID()
  payerId: string;

  @ApiProperty({ format: 'uuid', description: 'The listing owner.' })
  @IsUUID()
  payeeId: string;

  @ApiProperty({ enum: AUTHORIZATION_KINDS })
  @IsIn(AUTHORIZATION_KINDS)
  kind: AuthorizationKind;

  @ApiProperty({ description: 'Satang.', minimum: 1, maximum: MAX_SATANG })
  @IsInt()
  @Min(1)
  @Max(MAX_SATANG)
  amount: number;
}
