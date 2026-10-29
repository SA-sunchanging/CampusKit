import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';
import type { CaptureRequest } from '../../ledger/capture.js';
import { MAX_SATANG, OperationDto } from './operation.dto.js';

/** Body of POST /internal/payments/capture. Money is integer satang. */
export class CaptureDto extends OperationDto implements CaptureRequest {
  @ApiProperty({
    description:
      'The rental fee; must equal the fee authorization, or be 0 when there is none.',
    minimum: 0,
    maximum: MAX_SATANG,
  })
  @IsInt()
  @Min(0)
  @Max(MAX_SATANG)
  amount: number;
}
