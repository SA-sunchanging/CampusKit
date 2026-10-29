import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { RentalCancellationService } from '../rentals/rental-cancellation.service.js';
import { RentalCreationService } from '../rentals/rental-creation.service.js';
import { RentalQueriesService } from '../rentals/rental-queries.service.js';
import { CreateRentalResponse } from './create-rental.response.js';
import { CreateRentalDto } from './dto/create-rental.dto.js';
import { InternalRentalResponse } from './internal-rental.response.js';

/**
 * Service-to-service endpoints for Booking and Review. The gateway does not forward /internal
 * paths. Internal service authentication is still open (docs/architecture/services.md).
 */
@ApiTags('internal')
@Controller('internal/rentals')
export class InternalRentalsController {
  constructor(
    private readonly creation: RentalCreationService,
    private readonly queries: RentalQueriesService,
    private readonly cancellation: RentalCancellationService,
  ) {}

  /**
   * Cancels the rental of a booking before pickup; repeating it returns the CANCELLED rental.
   * 404 when the booking has no rental, 409 once the item is picked up.
   */
  @Post('by-booking/:bookingId/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: InternalRentalResponse })
  cancelByBooking(
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
  ): Promise<InternalRentalResponse> {
    return this.cancellation.cancelByBooking(bookingId);
  }

  /** Opens the rental of a confirmed booking; repeating it returns the same rental. */
  @Post()
  @ApiCreatedResponse({ type: CreateRentalResponse })
  create(@Body() dto: CreateRentalDto): Promise<CreateRentalResponse> {
    return this.creation.create(dto);
  }

  /** The people and status of a rental, for Review; 404 when unknown. */
  @Get(':id')
  @ApiOkResponse({ type: InternalRentalResponse })
  get(@Param('id', ParseUUIDPipe) id: string): Promise<InternalRentalResponse> {
    return this.queries.getInternal(id);
  }
}
