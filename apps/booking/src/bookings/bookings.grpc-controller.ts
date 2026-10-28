import { Metadata, status } from '@grpc/grpc-js';
import { Controller } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { GrpcMethod, RpcException } from '@nestjs/microservices';
import { CalendarService } from '../calendar/calendar.service.js';
import type { DateRange } from '../calendar/date-range.js';
import { callerFrom } from '../grpc-auth.js';

interface SetupCalendarRequest {
  listingId: string;
  blackouts?: DateRange[];
}

interface CheckAvailabilityRequest {
  listingId: string;
  period?: DateRange;
}

/**
 * gRPC handlers for libs/contracts/proto/booking.proto.
 * Operations owned by Booking (see docs/architecture/services.md): set calendar, check availability, request, approve, decline and cancel booking, scheduled expiry and compensation.
 */
@Controller()
export class BookingsGrpcController {
  constructor(
    private readonly calendar: CalendarService,
    private readonly jwt: JwtService,
  ) {}

  @GrpcMethod('BookingService', 'SetupCalendar')
  async setupCalendar(
    request: SetupCalendarRequest,
    metadata: Metadata,
  ): Promise<{ ok: boolean }> {
    const caller = callerFrom(metadata, this.jwt);
    await this.calendar.setupCalendar(
      caller,
      request.listingId,
      request.blackouts ?? [],
    );
    return { ok: true };
  }

  @GrpcMethod('BookingService', 'CheckAvailability')
  async checkAvailability(
    request: CheckAvailabilityRequest,
    metadata: Metadata,
  ): Promise<{ available: boolean }> {
    callerFrom(metadata, this.jwt);
    return {
      available: await this.calendar.checkAvailability(
        request.listingId,
        request.period,
      ),
    };
  }

  @GrpcMethod('BookingService', 'GetBooking')
  getBooking(): never {
    throw new RpcException({
      code: status.UNIMPLEMENTED,
      message: 'GetBooking is not implemented yet',
    });
  }
}
