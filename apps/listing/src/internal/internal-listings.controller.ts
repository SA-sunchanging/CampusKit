import {
  InternalAuthGuard,
  InternalCallers,
  SERVICE_TOKEN_HEADER,
} from '@app/common';
import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ListingQueriesService } from '../listings/listing-queries.service.js';
import { QuoteQuery } from './quote.query.js';
import { QuoteResponse } from './quote.response.js';

/**
 * Service-to-service endpoints for Booking. The gateway does not forward /internal paths, and
 * only Booking's service token is accepted
 * (docs/adr/adr-010-authenticate-internal-calls-with-service-tokens.md).
 */
@ApiTags('internal')
@ApiHeader({ name: SERVICE_TOKEN_HEADER, required: true })
@UseGuards(InternalAuthGuard)
@InternalCallers('booking')
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
