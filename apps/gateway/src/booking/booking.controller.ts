import { BOOKING_CLIENT } from '@app/contracts';
import { Controller, Get, Inject, OnModuleInit, Param } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { ApiTags } from '@nestjs/swagger';
import { firstValueFrom, type Observable } from 'rxjs';
import { toHttpError } from './grpc-error.js';

/** Methods of BookingService in libs/contracts/proto/booking.proto that the gateway calls. */
interface BookingService {
  getBooking(request: { id: string }): Observable<unknown>;
}

/** Translates client REST requests under /api/booking into Booking gRPC calls. Owner: Booking. */
@ApiTags('booking')
@Controller('api/booking')
export class BookingController implements OnModuleInit {
  private booking: BookingService;

  constructor(@Inject(BOOKING_CLIENT) private readonly client: ClientGrpc) {}

  onModuleInit(): void {
    this.booking = this.client.getService<BookingService>('BookingService');
  }

  @Get('bookings/:id')
  async getBooking(@Param('id') id: string): Promise<unknown> {
    try {
      return await firstValueFrom(this.booking.getBooking({ id }));
    } catch (error) {
      throw toHttpError(error);
    }
  }
}
