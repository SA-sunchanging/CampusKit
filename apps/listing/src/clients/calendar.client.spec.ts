import { checkServiceToken, INTERNAL_JWT_SECRET } from '@app/common';
import { JwtService } from '@nestjs/jwt';
import { status } from '@grpc/grpc-js';
import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { NEVER, of, throwError } from 'rxjs';
import {
  calendarErrorMessage,
  CalendarClient,
  CalendarSetupError,
} from './calendar.client.js';

const listingId = '11111111-1111-4111-8111-111111111111';
const call = { authorization: 'Bearer token', correlationId: 'corr-1' };

/** True when the metadata value is a valid service token signed for Listing. */
function signedByListing(token: unknown): boolean {
  const jwt = new JwtService({ secret: INTERNAL_JWT_SECRET });
  return checkServiceToken(jwt, token, ['listing']).ok;
}

function setup(result: unknown) {
  const setupCalendar = vi.fn().mockReturnValue(result);
  const filterAvailable = vi.fn().mockReturnValue(result);
  const client = {
    getService: vi.fn().mockReturnValue({ setupCalendar, filterAvailable }),
  } as unknown as ClientGrpc;
  const calendar = new CalendarClient(client);
  calendar.onModuleInit();
  return { calendar, setupCalendar, filterAvailable };
}

describe('CalendarClient.setupCalendar', () => {
  it('sends the blackouts with the caller token, service token and correlation ID', async () => {
    const { calendar, setupCalendar } = setup(of({ ok: true }));
    await calendar.setupCalendar(listingId, [], call);
    const [request, metadata] = setupCalendar.mock.calls[0];
    expect(request).toEqual({ listingId, blackouts: [] });
    expect(metadata.get('authorization')).toEqual(['Bearer token']);
    expect(metadata.get('x-correlation-id')).toEqual(['corr-1']);
    expect(signedByListing(metadata.get('x-service-token')[0])).toBe(true);
  });

  it('turns a gRPC error into a CalendarSetupError', async () => {
    const { calendar } = setup(
      throwError(() => ({ code: status.UNAVAILABLE, details: 'down' })),
    );
    await expect(calendar.setupCalendar(listingId, [], call)).rejects.toThrow(
      CalendarSetupError,
    );
  });

  it('gives up when Booking does not answer', async () => {
    vi.useFakeTimers();
    const { calendar } = setup(NEVER);
    const result = calendar.setupCalendar(listingId, [], call);
    const assertion = expect(result).rejects.toThrow('unavailable');
    await vi.advanceTimersByTimeAsync(5_000);
    await assertion;
    vi.useRealTimers();
  });
});

describe('CalendarClient.filterAvailable', () => {
  const period = {
    start: '2026-11-01T17:00:00.000Z',
    end: '2026-11-03T17:00:00.000Z',
  };

  it('sends the IDs and period with the service token and correlation ID and returns the free IDs', async () => {
    const { calendar, filterAvailable } = setup(
      of({ listingIds: [listingId] }),
    );
    await expect(
      calendar.filterAvailable([listingId], period, 'corr-1'),
    ).resolves.toEqual([listingId]);
    const [request, metadata] = filterAvailable.mock.calls[0];
    expect(request).toEqual({ listingIds: [listingId], period });
    expect(metadata.get('x-correlation-id')).toEqual(['corr-1']);
    expect(signedByListing(metadata.get('x-service-token')[0])).toBe(true);
  });

  it('reads an empty reply as no free listings', async () => {
    const { calendar } = setup(of({}));
    await expect(
      calendar.filterAvailable([listingId], period, 'corr-1'),
    ).resolves.toEqual([]);
  });

  it('answers 400 when Booking rejects the period and 503 when it is down', async () => {
    await expect(
      setup(
        throwError(() => ({ code: status.INVALID_ARGUMENT, details: 'bad' })),
      ).calendar.filterAvailable([listingId], period, 'corr-1'),
    ).rejects.toThrow(BadRequestException);
    await expect(
      setup(
        throwError(() => ({ code: status.UNAVAILABLE, details: 'down' })),
      ).calendar.filterAvailable([listingId], period, 'corr-1'),
    ).rejects.toThrow(ServiceUnavailableException);
  });
});

describe('calendarErrorMessage', () => {
  it('passes on why Booking refused the dates', () => {
    expect(
      calendarErrorMessage({
        code: status.ALREADY_EXISTS,
        details: 'A blackout overlaps a reserved period',
      }),
    ).toBe('The calendar was not saved: A blackout overlaps a reserved period');
  });

  it('asks to retry later for anything else', () => {
    expect(calendarErrorMessage({ code: status.UNIMPLEMENTED })).toContain(
      'try publishing again later',
    );
  });
});
