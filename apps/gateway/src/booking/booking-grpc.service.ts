import { BOOKING_CLIENT } from '@app/contracts';
import type { Metadata } from '@grpc/grpc-js';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, type Observable, timeout } from 'rxjs';
import { toHttpError } from './grpc-error.js';

/** Booking answers within this time, or the gateway answers 504. */
export const BOOKING_TIMEOUT_MS = 10_000;

/** Methods of BookingService in libs/contracts/proto/booking.proto that the gateway calls. */
interface BookingService {
  getBooking(request: { id: string }, metadata: Metadata): Observable<unknown>;
}

/** Calls Booking over gRPC as the caller, with a timeout, and turns gRPC errors into HTTP errors. */
@Injectable()
export class BookingGrpcService implements OnModuleInit {
  private booking: BookingService;

  constructor(@Inject(BOOKING_CLIENT) private readonly client: ClientGrpc) {}

  onModuleInit(): void {
    this.booking = this.client.getService<BookingService>('BookingService');
  }

  getBooking(id: string, metadata: Metadata): Promise<unknown> {
    return call(this.booking.getBooking({ id }, metadata));
  }
}

async function call<T>(reply: Observable<T>): Promise<T> {
  try {
    return await firstValueFrom(reply.pipe(timeout(BOOKING_TIMEOUT_MS)));
  } catch (error) {
    throw toHttpError(error);
  }
}
