import { Body, Controller, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiTags } from '@nestjs/swagger';
import { RentalCreationService } from '../rentals/rental-creation.service.js';
import { CreateRentalResponse } from './create-rental.response.js';
import { CreateRentalDto } from './dto/create-rental.dto.js';

/**
 * Service-to-service endpoints for Booking and Review. The gateway does not forward /internal
 * paths. Internal service authentication is still open (docs/architecture/services.md).
 */
@ApiTags('internal')
@Controller('internal/rentals')
export class InternalRentalsController {
  constructor(private readonly creation: RentalCreationService) {}

  /** Opens the rental of a confirmed booking; repeating it returns the same rental. */
  @Post()
  @ApiCreatedResponse({ type: CreateRentalResponse })
  create(@Body() dto: CreateRentalDto): Promise<CreateRentalResponse> {
    return this.creation.create(dto);
  }
}
