import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { MAX_PAGE_SIZE } from '../../listings/dto/search-listings.query.js';
import {
  LISTING_STATUSES,
  type ListingStatus,
} from '../../listings/listing-options.js';

/** Query of GET /admin/listings. Listings waiting for review by default. */
export class ReviewQueueQuery {
  @ApiPropertyOptional({ enum: LISTING_STATUSES, default: 'PENDING_REVIEW' })
  @IsOptional()
  @IsIn(LISTING_STATUSES)
  status: ListingStatus = 'PENDING_REVIEW';

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  page: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: MAX_PAGE_SIZE, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize: number = 20;
}
