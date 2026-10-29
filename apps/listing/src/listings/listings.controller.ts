import { type AuthUser, CurrentUser, JwtAuthGuard } from '@app/common';
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Call, type CallContext } from '../clients/call-context.js';
import { CreateListingDto } from './dto/create-listing.dto.js';
import { SearchListingsQuery } from './dto/search-listings.query.js';
import { ListingQueriesService } from './listing-queries.service.js';
import { SearchResultResponse } from './listing-summary.response.js';
import { ListingResponse } from './listing.response.js';
import { ListingsService } from './listings.service.js';
import { optionalViewer } from './optional-viewer.js';

/**
 * REST endpoints of the listing service, reached through the gateway at /api/listing/listings.
 * Operations owned by this service (see docs/architecture/services.md): create safe DRAFT, search, detail, quote, moderation, publish and unpublish.
 */
@ApiTags('listings')
@Controller('listings')
export class ListingsController {
  constructor(
    private readonly listings: ListingsService,
    private readonly queries: ListingQueriesService,
    private readonly jwt: JwtService,
  ) {}

  /** Public: guests can browse before they register. */
  @Get()
  @ApiOkResponse({ type: SearchResultResponse })
  search(@Query() query: SearchListingsQuery): Promise<SearchResultResponse> {
    return this.queries.search(query);
  }

  /** Public. Any status but PUBLISHED is shown only to its owner and administrators. */
  @Get(':id')
  @ApiOkResponse({ type: ListingResponse })
  detail(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('authorization') authorization?: string,
  ): Promise<ListingResponse> {
    return this.queries.detail(id, optionalViewer(authorization, this.jwt));
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiCreatedResponse({
    type: ListingResponse,
    description:
      'PUBLISHED, or DRAFT with publishError when the calendar could not be set up.',
  })
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateListingDto,
    @Call() call: CallContext,
  ): Promise<ListingResponse> {
    return this.listings.create(user, dto, call);
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: ListingResponse })
  publish(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Call() call: CallContext,
  ): Promise<ListingResponse> {
    return this.listings.publish(user, id, call);
  }
}
