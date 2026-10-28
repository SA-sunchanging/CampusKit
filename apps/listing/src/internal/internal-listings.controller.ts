import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ListingQueriesService } from '../listings/listing-queries.service.js';
import { QuoteQuery } from './quote.query.js';
import { QuoteResponse } from './quote.response.js';

/**
 * Service-to-service endpoints for Booking. The gateway does not forward /internal paths.
 * Internal service authentication is still open (docs/architecture/services.md).
 */
@ApiTags('internal')
@Controller('internal/listings')
export class InternalListingsController {
  constructor(private readonly queries: ListingQueriesService) {}

  @Get(':id/quote')
  @ApiOkResponse({ type: QuoteResponse })
  quote(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: QuoteQuery,
  ): Promise<QuoteResponse> {
    return this.queries.quote(id, query);
  }
}
