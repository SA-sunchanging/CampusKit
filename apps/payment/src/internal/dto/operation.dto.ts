import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, Length } from 'class-validator';

/** The largest amount PostgreSQL's integer holds, in satang. */
export const MAX_SATANG = 2_147_483_647;

/** Fields of every ledger request. */
export class OperationDto {
  @ApiProperty({
    description:
      'Stable ID chosen by the caller; repeating it with the same body returns the first reply.',
    example: 'booking:22222222-2222-4222-8222-222222222222:authorize-fee',
    minLength: 1,
    maxLength: 200,
  })
  @IsString()
  @Length(1, 200)
  operationId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  bookingId: string;
}
