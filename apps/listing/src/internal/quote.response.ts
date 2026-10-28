import { ApiProperty } from '@nestjs/swagger';
import type { Quote } from './quote.js';

/** Body of GET /internal/listings/{id}/quote. Money is integer satang, as in the proto Terms. */
export class QuoteResponse {
  @ApiProperty({ format: 'uuid' })
  listingId: string;

  @ApiProperty({ format: 'uuid' })
  ownerId: string;

  @ApiProperty({ description: 'Whole rental days in the period.' })
  days: number;

  @ApiProperty({ description: 'Daily rate times days.' })
  rentalFee: number;

  @ApiProperty()
  deposit: number;

  @ApiProperty()
  lateFeePerDay: number;

  static of(quote: Quote): QuoteResponse {
    return Object.assign(new QuoteResponse(), quote);
  }
}
