import { type AuthUser, CurrentUser, JwtAuthGuard } from '@app/common';
import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ListRentalsQuery } from './dto/list-rentals.query.js';
import { RentalQueriesService } from './rental-queries.service.js';
import { RentalListResponse, RentalResponse } from './rental.response.js';

/**
 * REST endpoints of the rental service, reached through the gateway at /api/rental/rentals.
 * Operations owned by this service (see docs/architecture/services.md): pickup and return codes,
 * confirm pickup and return, and settlement. Only the renter and the owner read a rental.
 */
@ApiTags('rentals')
@Controller('rentals')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RentalsController {
  constructor(private readonly queries: RentalQueriesService) {}

  @Get()
  @ApiOkResponse({ type: RentalListResponse })
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: ListRentalsQuery,
  ): Promise<RentalListResponse> {
    return this.queries.list(user, query.role);
  }

  @Get(':id')
  @ApiOkResponse({ type: RentalResponse })
  get(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RentalResponse> {
    return this.queries.get(user, id);
  }
}
