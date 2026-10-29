import {
  CorrelationInterceptor,
  createHttpService,
  envPort,
  listen,
} from '@app/common';
import { BOOKING_PACKAGE, BOOKING_PROTO_PATH } from '@app/contracts';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { BookingModule } from './booking.module.js';

async function bootstrap() {
  // Booking serves gRPC for other services. Its small HTTP port only serves /health and /docs.
  const app = await createHttpService(BookingModule, 'booking');
  app
    .connectMicroservice<MicroserviceOptions>({
      transport: Transport.GRPC,
      options: {
        package: BOOKING_PACKAGE,
        protoPath: BOOKING_PROTO_PATH,
        url: `0.0.0.0:${envPort('PORT', 50051)}`,
      },
    })
    // Each gRPC call runs under the correlation ID in its metadata, so its log lines carry it.
    .useGlobalInterceptors(new CorrelationInterceptor());
  await app.startAllMicroservices();
  await listen(app, 'booking', envPort('HTTP_PORT', 3007));
}
await bootstrap();
