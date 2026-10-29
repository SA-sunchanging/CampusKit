import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDefined,
  IsInt,
  IsISO8601,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import type { CreateRentalRequest } from '../../rentals/rental-creation.service.js';

/** The largest amount PostgreSQL's integer holds, in satang. */
export const MAX_SATANG = 2_147_483_647;

/** A half-open period [start, end), ISO-8601 UTC. The service checks that end is after start. */
export class PeriodDto {
  @ApiProperty({ example: '2026-11-01T17:00:00.000Z' })
  @IsISO8601({ strict: true })
  start: string;

  @ApiProperty({ example: '2026-11-04T17:00:00.000Z' })
  @IsISO8601({ strict: true })
  end: string;
}

/** The booking's terms. Money is integer satang. */
export class TermsDto {
  @ApiProperty({ description: 'Satang.', minimum: 0, maximum: MAX_SATANG })
  @IsInt()
  @Min(0)
  @Max(MAX_SATANG)
  rentalFee: number;

  @ApiProperty({ description: 'Satang.', minimum: 0, maximum: MAX_SATANG })
  @IsInt()
  @Min(0)
  @Max(MAX_SATANG)
  deposit: number;

  @ApiProperty({
    description: 'Satang per day late.',
    minimum: 0,
    maximum: MAX_SATANG,
  })
  @IsInt()
  @Min(0)
  @Max(MAX_SATANG)
  lateFeePerDay: number;
}

/** Body of POST /internal/rentals, sent by Booking when it confirms a booking. */
export class CreateRentalDto implements CreateRentalRequest {
  @ApiProperty({ format: 'uuid', description: 'One rental per booking.' })
  @IsUUID()
  bookingId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  listingId: string;

  @ApiProperty({ format: 'uuid', description: 'The listing owner.' })
  @IsUUID()
  ownerId: string;

  @ApiProperty({ format: 'uuid', description: 'Must differ from ownerId.' })
  @IsUUID()
  renterId: string;

  @ApiProperty({ type: PeriodDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => PeriodDto)
  period: PeriodDto;

  @ApiProperty({ type: TermsDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => TermsDto)
  terms: TermsDto;
}
