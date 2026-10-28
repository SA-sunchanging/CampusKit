import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601 } from 'class-validator';

/** Query of GET /internal/listings/{id}/quote: the half-open rental period [start, end). */
export class QuoteQuery {
  @ApiProperty({ example: '2026-11-01T17:00:00Z' })
  @IsISO8601({ strict: true })
  start: string;

  @ApiProperty({ example: '2026-11-04T17:00:00Z' })
  @IsISO8601({ strict: true })
  end: string;
}
