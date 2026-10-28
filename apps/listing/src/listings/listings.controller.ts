import { type AuthUser, CurrentUser, JwtAuthGuard } from '@app/common';
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Call, type CallContext } from '../clients/call-context.js';
import { CreateListingDto } from './dto/create-listing.dto.js';
import { ListingResponse } from './listing.response.js';
import { ListingsService } from './listings.service.js';

/**
 * REST endpoints of the listing service, reached through the gateway at /api/listing/listings.
 * Operations owned by this service (see docs/architecture/services.md): create safe DRAFT, search, detail, quote, moderation, publish and unpublish.
 */
@ApiTags('listings')
@Controller('listings')
export class ListingsController {
  constructor(private readonly listings: ListingsService) {}

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
