import { Metadata, status } from '@grpc/grpc-js';
import { HttpException, HttpStatus } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { NEVER, of, throwError } from 'rxjs';
import {
  BOOKING_TIMEOUT_MS,
  BookingGrpcService,
} from './booking-grpc.service.js';

const id = '33333333-3333-4333-8333-333333333333';

function setup(result: unknown) {
  const getBooking = vi.fn().mockReturnValue(result);
  const client = {
    getService: vi.fn().mockReturnValue({ getBooking }),
  } as unknown as ClientGrpc;
  const service = new BookingGrpcService(client);
  service.onModuleInit();
  return { service, getBooking };
}

async function rejection(promise: Promise<unknown>): Promise<HttpException> {
  try {
    await promise;
  } catch (error) {
    return error as HttpException;
  }
  throw new Error('expected a rejection');
}

describe('BookingGrpcService', () => {
  it('sends the request with the caller metadata', async () => {
    const { service, getBooking } = setup(of({ id, status: 'PENDING' }));
    const metadata = new Metadata();
    const booking = await service.getBooking(id, metadata);
    expect(booking).toMatchObject({ id, status: 'PENDING', declineReason: '' });
    expect(getBooking).toHaveBeenCalledWith({ id }, metadata);
  });

  it('turns a gRPC error into the matching HTTP error', async () => {
    const { service } = setup(
      throwError(() => ({ code: status.NOT_FOUND, details: 'No booking' })),
    );
    const error = await rejection(service.getBooking(id, new Metadata()));
    expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
  });

  it('answers 504 when Booking does not answer in time', async () => {
    vi.useFakeTimers();
    try {
      const { service } = setup(NEVER);
      const result = rejection(service.getBooking(id, new Metadata()));
      await vi.advanceTimersByTimeAsync(BOOKING_TIMEOUT_MS);
      expect((await result).getStatus()).toBe(HttpStatus.GATEWAY_TIMEOUT);
    } finally {
      vi.useRealTimers();
    }
  });
});
