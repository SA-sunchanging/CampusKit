import { join } from 'node:path';
import { ClientsModule, Transport } from '@nestjs/microservices';

/**
 * gRPC contract of the Booking service. The source of truth is libs/contracts/proto/booking.proto.
 * Clients: Gateway, Listing, Rental.
 */
export const BOOKING_PACKAGE = 'campuskit.booking';
export const BOOKING_PROTO_PATH = join(
  process.cwd(),
  'libs/contracts/proto/booking.proto',
);
export const BOOKING_CLIENT = 'BOOKING_CLIENT';

/** Registers a gRPC client for Booking. Inject it with `@Inject(BOOKING_CLIENT) client: ClientGrpc`. */
export const BookingClientModule = ClientsModule.register([
  {
    name: BOOKING_CLIENT,
    transport: Transport.GRPC,
    options: {
      package: BOOKING_PACKAGE,
      protoPath: BOOKING_PROTO_PATH,
      url: process.env.BOOKING_GRPC_URL ?? 'localhost:50051',
    },
  },
]);
