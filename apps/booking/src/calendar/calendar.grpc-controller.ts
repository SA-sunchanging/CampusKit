import { Metadata } from '@grpc/grpc-js';
import { Controller } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { GrpcMethod } from '@nestjs/microservices';
import { callerFrom } from '../grpc-auth.js';
import { CalendarService } from './calendar.service.js';
import type { DateRange } from './date-range.js';

interface SetupCalendarRequest {
  listingId: string;
  blackouts?: DateRange[];
}

interface ReleaseCalendarRequest {
  bookingId?: string;
}

interface CheckAvailabilityRequest {
  listingId: string;
  period?: DateRange;
}

/** Calendar handlers of libs/contracts/proto/booking.proto; the booking handlers live in bookings/. */
@Controller()
export class CalendarGrpcController {
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

  @GrpcMethod('BookingService', 'ReleaseCalendar')
  async releaseCalendar(
    request: ReleaseCalendarRequest,
    metadata: Metadata,
  ): Promise<{ ok: boolean }> {
    const caller = callerFrom(metadata, this.jwt);
    await this.calendar.releaseCalendar(caller, request.bookingId ?? '');
    return { ok: true };
  }
}
