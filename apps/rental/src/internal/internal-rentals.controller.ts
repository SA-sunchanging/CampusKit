import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
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
  ) {}

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
