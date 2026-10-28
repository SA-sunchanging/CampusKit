import { status } from '@grpc/grpc-js';
import type { ClientGrpc } from '@nestjs/microservices';
import { NEVER, of, throwError } from 'rxjs';
import {
  calendarErrorMessage,
  CalendarClient,
  CalendarSetupError,
} from './calendar.client.js';

const listingId = '11111111-1111-4111-8111-111111111111';
const call = { authorization: 'Bearer token', correlationId: 'corr-1' };

function setup(result: unknown) {
  const setupCalendar = vi.fn().mockReturnValue(result);
  const client = {
    getService: vi.fn().mockReturnValue({ setupCalendar }),
  } as unknown as ClientGrpc;
  const calendar = new CalendarClient(client);
  calendar.onModuleInit();
  return { calendar, setupCalendar };
}

describe('CalendarClient.setupCalendar', () => {
  it('sends the blackouts with the caller token and correlation ID', async () => {
    const { calendar, setupCalendar } = setup(of({ ok: true }));
    await calendar.setupCalendar(listingId, [], call);
    const [request, metadata] = setupCalendar.mock.calls[0];
    expect(request).toEqual({ listingId, blackouts: [] });
    expect(metadata.get('authorization')).toEqual(['Bearer token']);
    expect(metadata.get('x-correlation-id')).toEqual(['corr-1']);
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
