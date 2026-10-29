import { ConflictException } from '@nestjs/common';
import {
  authorizationRow,
  BOOKING_ID,
  errorOf,
  type FakeLedgerState,
  fakeLedger,
  NOW,
} from '../testing/fake-ledger.js';
import type { AuthorizationRow } from './authorization.row.js';
import { type CaptureRequest, CaptureService } from './capture.js';

const request: CaptureRequest = {
  operationId: 'rental:r1:capture-fee',
  bookingId: BOOKING_ID,
  amount: 6000,
};

/** Applies "SET status = 'CAPTURED', captured_amount = $2 WHERE id = $1". */
function captureHandler(
  sql: string,
  params: unknown[],
  state: FakeLedgerState,
) {
  if (!sql.includes("SET status = 'CAPTURED'")) {
    return undefined;
  }
  const row = state.authorizations.find(
    (item) => item.id === params[0] && item.status === 'AUTHORIZED',
  );
  if (!row) {
    return [[], 0];
  }
  Object.assign(row, {
    status: 'CAPTURED',
    captured_amount: params[1] as number,
  });
  return [[row], 1];
}

function setup(initial: AuthorizationRow[] = [authorizationRow()]) {
  const ledger = fakeLedger(initial, captureHandler);
  return { ...ledger, service: new CaptureService(ledger.db) };
}

async function conflictMessage(promise: Promise<unknown>) {
  const err = await errorOf(promise);
  expect(err).toBeInstanceOf(ConflictException);
  return (err as Error).message;
}

describe('CaptureService', () => {
  it('captures the authorized fee', async () => {
    const { service, state } = setup();
    await expect(service.capture(request, NOW)).resolves.toEqual({
      bookingId: BOOKING_ID,
      kind: 'FEE',
      capturedAmount: 6000,
      status: 'CAPTURED',
    });
    expect(state.authorizations[0]).toMatchObject({
      status: 'CAPTURED',
      captured_amount: 6000,
    });
    expect(state.entries.get(request.operationId)?.operation).toBe('CAPTURE');
  });

  it('returns the first reply when the capture is repeated', async () => {
    const { service, state } = setup();
    const first = await service.capture(request, NOW);
    await expect(service.capture({ ...request }, NOW)).resolves.toEqual(first);
    const updates = state.queries.filter(({ sql }) =>
      sql.includes("SET status = 'CAPTURED'"),
    );
    expect(updates).toHaveLength(1);
  });

  it('succeeds without a change when there is no fee and the amount is 0', async () => {
    const { service, state } = setup([]);
    await expect(
      service.capture({ ...request, amount: 0 }, NOW),
    ).resolves.toMatchObject({ capturedAmount: 0, status: 'NOT_REQUIRED' });
    expect(state.entries.size).toBe(1);
  });

  it('refuses an amount when the booking has no fee authorization', async () => {
    const { service, state } = setup([]);
    expect(await conflictMessage(service.capture(request, NOW))).toBe(
      'The booking has no fee authorization',
    );
    expect(state.entries.size).toBe(0);
  });

  it('refuses an amount that does not match the authorization', async () => {
    const { service } = setup();
    expect(
      await conflictMessage(service.capture({ ...request, amount: 0 }, NOW)),
    ).toBe('The amount 0 does not match the fee authorization of 6000');
  });

  it('refuses an expired authorization', async () => {
    const { service, state } = setup([authorizationRow({ expires_at: NOW })]);
    expect(await conflictMessage(service.capture(request, NOW))).toBe(
      'The fee authorization has expired',
    );
    expect(state.authorizations[0].status).toBe('AUTHORIZED');
  });

  it.each(['CAPTURED', 'SETTLED', 'VOIDED'] as const)(
    'refuses a %s authorization under a new operation ID',
    async (status) => {
      const { service, state } = setup([authorizationRow({ status })]);
      expect(await conflictMessage(service.capture(request, NOW))).toBe(
        `The fee authorization is ${status}`,
      );
      expect(state.entries.size).toBe(0);
    },
  );

  it('ignores the deposit', async () => {
    const { service, state } = setup([
      authorizationRow(),
      authorizationRow({ id: 'dep', kind: 'DEPOSIT', amount: 30000 }),
    ]);
    await service.capture(request, NOW);
    expect(state.authorizations[1].status).toBe('AUTHORIZED');
  });
});
