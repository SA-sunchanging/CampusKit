import { type AuthUser, CurrentUser, JwtAuthGuard } from '@app/common';
import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  EarningsResponse,
  PaymentStatusResponse,
} from './payment-status.response.js';
import { PaymentStatusService } from './payment-status.service.js';

/**
 * REST endpoints of the payment service, reached through the gateway at /api/payment/payments.
 * Operations owned by this service (see docs/architecture/services.md): fee and deposit
 * authorization, capture, void, late-fee settlement and payout; the money-moving operations
 * are internal endpoints for Booking and Rental.
 */
@ApiTags('payments')
@Controller('payments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PaymentsController {
  constructor(private readonly status: PaymentStatusService) {}

  @Get('me/earnings')
  @ApiOkResponse({ type: EarningsResponse })
  earnings(@CurrentUser() user: AuthUser): Promise<EarningsResponse> {
    return this.status.earnings(user);
  }

  /** The holds and payout of a booking, for its renter or owner. */
  @Get('bookings/:bookingId')
  @ApiOkResponse({ type: PaymentStatusResponse })
  forBooking(
    @CurrentUser() user: AuthUser,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
  ): Promise<PaymentStatusResponse> {
    return this.status.forBooking(user, bookingId);
  }
}
