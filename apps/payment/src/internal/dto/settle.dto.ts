import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';
import type { SettleRequest } from '../../ledger/settle.js';
import { MAX_SATANG, OperationDto } from './operation.dto.js';

/** Body of POST /internal/payments/settle. Money is integer satang. */
export class SettleDto extends OperationDto implements SettleRequest {
  @ApiProperty({
    description:
      "The booking's deposit; must equal the deposit authorization, or be 0 when there is none.",
    minimum: 0,
    maximum: MAX_SATANG,
  })
  @IsInt()
  @Min(0)
  @Max(MAX_SATANG)
  deposit: number;

  @ApiProperty({
    description: 'The late fee; at most the deposit is taken.',
    minimum: 0,
    maximum: MAX_SATANG,
  })
  @IsInt()
  @Min(0)
  @Max(MAX_SATANG)
  lateFee: number;
}
