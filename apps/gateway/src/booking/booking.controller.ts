import type { Metadata } from '@grpc/grpc-js';
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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { BookingGrpcService } from './booking-grpc.service.js';
import {
  AvailabilityResponse,
  BookingListResponse,
  BookingResponse,
} from './booking.response.js';
import { AvailabilityQuery } from './dto/availability.query.js';
import { CancelBookingDto } from './dto/cancel-booking.dto.js';
import { DeclineBookingDto } from './dto/decline-booking.dto.js';
import { ListBookingsQuery } from './dto/list-bookings.query.js';
import { RequestBookingDto } from './dto/request-booking.dto.js';
import { CallMetadata } from './grpc-metadata.js';

/**
 * Translates client REST requests under /api/booking into Booking gRPC calls. Owner: Booking.
 * Every route needs a token; Booking reads the caller from it and checks who may do what.
 */
@ApiTags('booking')
@ApiBearerAuth()
@Controller('api/booking')
export class BookingController {
  constructor(private readonly booking: BookingGrpcService) {}

  @Post('bookings')
  @ApiCreatedResponse({ type: BookingResponse, description: 'PENDING.' })
  requestBooking(
    @Body() dto: RequestBookingDto,
    @CallMetadata() metadata: Metadata,
  ): Promise<BookingResponse> {
    return this.booking.requestBooking(dto.listingId, dto.period, metadata);
  }

  @Get('bookings')
  @ApiOkResponse({ type: BookingListResponse })
  listBookings(
    @Query() query: ListBookingsQuery,
    @CallMetadata() metadata: Metadata,
  ): Promise<BookingListResponse> {
    return this.booking.listBookings(query.role, query.status, metadata);
  }

  @Get('bookings/:id')
  @ApiOkResponse({ type: BookingResponse })
  getBooking(
    @Param('id', ParseUUIDPipe) id: string,
    @CallMetadata() metadata: Metadata,
  ): Promise<BookingResponse> {
    return this.booking.getBooking(id, metadata);
  }

  @Post('bookings/:id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    type: BookingResponse,
    description: 'CONFIRMED, or AUTHORIZING when payment or rental failed.',
  })
  approveBooking(
    @Param('id', ParseUUIDPipe) id: string,
    @CallMetadata() metadata: Metadata,
  ): Promise<BookingResponse> {
    return this.booking.approveBooking(id, metadata);
  }

  @Post('bookings/:id/decline')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: BookingResponse, description: 'DECLINED.' })
  declineBooking(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DeclineBookingDto,
    @CallMetadata() metadata: Metadata,
  ): Promise<BookingResponse> {
    return this.booking.declineBooking(id, dto?.reason, metadata);
  }

  @Post('bookings/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    type: BookingResponse,
    description:
      'CANCELLED. 403 for anyone but the renter and the owner; 409 unless the booking is ' +
      'PENDING or CONFIRMED, or once the item is picked up.',
  })
  cancelBooking(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelBookingDto,
    @CallMetadata() metadata: Metadata,
  ): Promise<BookingResponse> {
    return this.booking.cancelBooking(id, dto?.reason, metadata);
  }

  @Get('listings/:listingId/availability')
  @ApiOkResponse({ type: AvailabilityResponse })
  checkAvailability(
    @Param('listingId', ParseUUIDPipe) listingId: string,
    @Query() query: AvailabilityQuery,
    @CallMetadata() metadata: Metadata,
  ): Promise<AvailabilityResponse> {
    return this.booking.checkAvailability(listingId, query, metadata);
  }
}
