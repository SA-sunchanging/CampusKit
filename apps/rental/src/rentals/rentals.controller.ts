import { type AuthUser, CurrentUser, JwtAuthGuard } from '@app/common';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Call, type CallContext } from '../clients/call-context.js';
import { CodeDto, ReturnDto } from './dto/code.dto.js';
import { ListRentalsQuery } from './dto/list-rentals.query.js';
import { PickupService } from './pickup.service.js';
import { RentalQueriesService } from './rental-queries.service.js';
import { RentalListResponse, RentalResponse } from './rental.response.js';
import { ReturnService } from './return.service.js';

/**
 * REST endpoints of the rental service, reached through the gateway at /api/rental/rentals.
 * The rules are in docs/architecture/services.md. Only the renter and the owner read a rental;
 * the renter confirms pickup and the owner confirms the return.
 */
@ApiTags('rentals')
@Controller('rentals')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RentalsController {
  constructor(
    private readonly queries: RentalQueriesService,
    private readonly pickups: PickupService,
    private readonly returns: ReturnService,
  ) {}

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

  /** The renter enters the owner's pickup code; the fee is captured and the rental is ACTIVE. */
  @Post(':id/pickup')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: RentalResponse })
  pickup(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CodeDto,
    @Call() call: CallContext,
  ): Promise<RentalResponse> {
    return this.pickups.pickup(user, id, dto.code, call);
  }

  /**
   * The owner enters the renter's return code; the dates are released, Payment settles, and the
   * rental is CLOSED. A failed settlement answers 200 with SETTLEMENT_PENDING and lastError;
   * calling it again (without a code) retries.
   */
  @Post(':id/return')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: RentalResponse })
  confirmReturn(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReturnDto,
    @Call() call: CallContext,
  ): Promise<RentalResponse> {
    return this.returns.confirmReturn(user, id, dto.code, call);
  }
}
