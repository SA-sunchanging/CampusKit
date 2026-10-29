import { status } from '@grpc/grpc-js';
import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { rpcError } from '../errors.js';

/**
 * Booking handlers of libs/contracts/proto/booking.proto; the calendar handlers live in calendar/.
 * Operations owned by Booking (see docs/architecture/services.md): request, approve, decline,
 * get and list bookings.
 */
@Controller()
export class BookingsGrpcController {
  @GrpcMethod('BookingService', 'GetBooking')
  getBooking(): never {
    throw rpcError(status.UNIMPLEMENTED, 'GetBooking is not implemented yet');
  }
}
