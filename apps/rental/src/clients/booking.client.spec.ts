import { checkServiceToken, INTERNAL_JWT_SECRET } from '@app/common';
import { JwtService } from '@nestjs/jwt';
import { status } from '@grpc/grpc-js';
import type { ClientGrpc } from '@nestjs/microservices';
import { NEVER, of, throwError } from 'rxjs';
import {
  BookingClient,
  bookingFailure,
  type BookingView,
  TIMEOUT_MS,
} from './booking.client.js';

const call = { authorization: 'Bearer token', correlationId: 'corr-1' };

/** True when the value is a valid service token signed for Rental. */
function signedByRental(token: unknown): boolean {
  const jwt = new JwtService({ secret: INTERNAL_JWT_SECRET });
  return checkServiceToken(jwt, token, ['rental']).ok;
}
const booking: BookingView = {
  id: 'b1',
  listingId: 'l1',
  renterId: 'u2',
  ownerId: 'u1',
  status: 'CONFIRMED',
  period: {
    start: '2026-11-01T17:00:00.000Z',
    end: '2026-11-04T17:00:00.000Z',
  },
  terms: { rentalFee: 6000, deposit: 30000, lateFeePerDay: 4000 },
};

function setup(methods: { getBooking?: unknown; releaseCalendar?: unknown }) {
  const getBooking = vi.fn().mockReturnValue(methods.getBooking);
  const releaseCalendar = vi.fn().mockReturnValue(methods.releaseCalendar);
  const grpc = {
    getService: vi.fn().mockReturnValue({ getBooking, releaseCalendar }),
  } as unknown as ClientGrpc;
  const client = new BookingClient(grpc);
  client.onModuleInit();
  return { client, getBooking, releaseCalendar };
}

describe('BookingClient', () => {
  describe('getBooking', () => {
    it('reads the booking with the caller token and correlation ID', async () => {
      const { client, getBooking } = setup({ getBooking: of(booking) });
      await expect(client.getBooking('b1', call)).resolves.toEqual({
        ok: true,
        value: booking,
      });
      const [request, metadata] = getBooking.mock.calls[0];
      expect(request).toEqual({ id: 'b1' });
      expect(metadata.get('authorization')).toEqual(['Bearer token']);
      expect(metadata.get('x-correlation-id')).toEqual(['corr-1']);
    });

    it('reports NOT_FOUND as declined with the Booking message', async () => {
      const { client } = setup({
        getBooking: throwError(() => ({
          code: status.NOT_FOUND,
          details: 'Booking not found',
        })),
      });
      await expect(client.getBooking('b1', call)).resolves.toEqual({
        ok: false,
        reason: 'declined',
        message: 'Booking not found',
      });
    });

    it('reports an unexpected message as unavailable', async () => {
      const { client } = setup({ getBooking: of({ id: 'b1' }) });
      await expect(client.getBooking('b1', call)).resolves.toMatchObject({
        ok: false,
        reason: 'unavailable',
      });
    });

    it('gives up when Booking does not answer', async () => {
      vi.useFakeTimers();
      try {
        const { client } = setup({ getBooking: NEVER });
        const result = client.getBooking('b1', call);
        await vi.advanceTimersByTimeAsync(TIMEOUT_MS);
        await expect(result).resolves.toEqual({
          ok: false,
          reason: 'unavailable',
          message: 'The booking service is unavailable',
        });
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('releaseCalendar', () => {
    it('releases the dates as the caller, with the service token', async () => {
      const { client, releaseCalendar } = setup({
        releaseCalendar: of({ ok: true }),
      });
      await expect(client.releaseCalendar('b1', call)).resolves.toEqual({
        ok: true,
        value: true,
      });
      const [request, metadata] = releaseCalendar.mock.calls[0];
      expect(request).toEqual({ bookingId: 'b1' });
      expect(metadata.get('authorization')).toEqual(['Bearer token']);
      expect(signedByRental(metadata.get('x-service-token')[0])).toBe(true);
    });

    it('reports FAILED_PRECONDITION as declined', async () => {
      const { client } = setup({
        releaseCalendar: throwError(() => ({
          code: status.FAILED_PRECONDITION,
          details: 'Only a confirmed booking can release its dates',
        })),
      });
      await expect(client.releaseCalendar('b1', call)).resolves.toEqual({
        ok: false,
        reason: 'declined',
        message: 'Only a confirmed booking can release its dates',
      });
    });
  });
});

describe('bookingFailure', () => {
  it.each([
    status.NOT_FOUND,
    status.PERMISSION_DENIED,
    status.FAILED_PRECONDITION,
    status.INVALID_ARGUMENT,
  ])('treats code %i as declined', (code) => {
    expect(bookingFailure({ code })).toEqual({
      ok: false,
      reason: 'declined',
      message: 'The booking service refused the request',
    });
  });

  it.each([
    status.UNAVAILABLE,
    status.DEADLINE_EXCEEDED,
    status.INTERNAL,
    status.UNAUTHENTICATED,
  ])('treats code %i as unavailable', (code) => {
    expect(bookingFailure({ code, details: 'x' })).toMatchObject({
      reason: 'unavailable',
      message: 'The booking service is unavailable',
    });
  });

  it('treats an error without a code (a timeout) as unavailable', () => {
    expect(bookingFailure(new Error('Timeout has occurred'))).toMatchObject({
      reason: 'unavailable',
    });
  });
});
