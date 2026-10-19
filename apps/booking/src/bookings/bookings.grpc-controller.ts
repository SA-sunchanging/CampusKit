import { status } from '@grpc/grpc-js';
import { Controller } from '@nestjs/common';
import { GrpcMethod, RpcException } from '@nestjs/microservices';

/**
 * gRPC handlers for libs/contracts/proto/booking.proto.
 * Operations owned by Booking (see docs/architecture/services.md): set calendar, check availability, request, approve, decline and cancel booking, scheduled expiry and compensation.
 */
@Controller()
export class BookingsGrpcController {
  @GrpcMethod('BookingService', 'SetupCalendar')
  setupCalendar(): never {
    throw new RpcException({
      code: status.UNIMPLEMENTED,
      message: 'SetupCalendar is not implemented yet',
    });
  }

  @GrpcMethod('BookingService', 'GetBooking')
  getBooking(): never {
    throw new RpcException({
      code: status.UNIMPLEMENTED,
      message: 'GetBooking is not implemented yet',
    });
  }
}
