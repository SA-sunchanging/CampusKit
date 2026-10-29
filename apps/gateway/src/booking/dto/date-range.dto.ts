import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601 } from 'class-validator';

/** A half-open period [start, end), ISO-8601 UTC. Booking checks the dates themselves. */
export class DateRangeDto {
  @ApiProperty({ example: '2026-11-01T17:00:00Z' })
  @IsISO8601({ strict: true })
  start: string;

  @ApiProperty({ example: '2026-11-04T17:00:00Z' })
  @IsISO8601({ strict: true })
  end: string;
}
