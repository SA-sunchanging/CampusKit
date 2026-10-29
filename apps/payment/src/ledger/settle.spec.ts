import { ConflictException } from '@nestjs/common';
import {
  authorizationRow,
  BOOKING_ID,
  errorOf,
  type FakeLedgerState,
  fakeLedger,
  NOW,
  OWNER_ID,
} from '../testing/fake-ledger.js';
import type { AuthorizationRow } from './authorization.row.js';
import { type SettleRequest, SettleService } from './settle.js';

const request: SettleRequest = {
  operationId: 'rental:r1:settle',
  bookingId: BOOKING_ID,
  deposit: 30000,
  lateFee: 8000,
};

const capturedFee = authorizationRow({
  id: 'fee',
  status: 'CAPTURED',
  captured_amount: 6000,
});
const deposit = authorizationRow({
  id: 'dep',
  kind: 'DEPOSIT',
  amount: 30000,
});

/** Applies the deposit update and records payouts. */
function settleHandler(paid: unknown[][]) {
  return (sql: string, params: unknown[], state: FakeLedgerState) => {
    if (sql.includes("SET status = 'SETTLED'")) {
      const row = state.authorizations.find((item) => item.id === params[0]);
      Object.assign(row ?? {}, {
        status: 'SETTLED',
        captured_amount: params[1] as number,
        released_amount: params[2] as number,
      });
      return [[], 1];
    }
    if (sql.includes('INSERT INTO payouts')) {
      paid.push(params);
      return [];
    }
    if (sql.includes('FROM payouts')) {
      return paid.filter((payout) => payout[0] === params[0]).map(() => ({}));
    }
    return undefined;
  };
}

function setup(initial: AuthorizationRow[] = [capturedFee, deposit]) {
  const paid: unknown[][] = [];
  const ledger = fakeLedger(initial, settleHandler(paid));
  return { ...ledger, paid, service: new SettleService(ledger.db) };
}

async function conflictMessage(promise: Promise<unknown>) {
  const err = await errorOf(promise);
  expect(err).toBeInstanceOf(ConflictException);
  return (err as Error).message;
}

describe('SettleService', () => {
  it('takes the late fee from the deposit and pays the owner', async () => {
    const { service, state, paid } = setup();
    await expect(service.settle(request, NOW)).resolves.toEqual({
      bookingId: BOOKING_ID,
      lateFeeCharged: 8000,
      depositReleased: 22000,
      payout: 14000,
    });
    expect(state.authorizations[1]).toMatchObject({
      status: 'SETTLED',
      captured_amount: 8000,
      released_amount: 22000,
    });
    expect(paid).toEqual([[BOOKING_ID, OWNER_ID, 14000, NOW]]);
    expect(state.entries.get(request.operationId)?.operation).toBe('SETTLE');
  });

  it('caps the late fee at the deposit', async () => {
    const { service } = setup();
    await expect(
      service.settle({ ...request, lateFee: 50000 }, NOW),
    ).resolves.toMatchObject({
      lateFeeCharged: 30000,
      depositReleased: 0,
      payout: 36000,
    });
  });

  it('releases the whole deposit when the return is on time', async () => {
    const { service } = setup();
    await expect(
      service.settle({ ...request, lateFee: 0 }, NOW),
    ).resolves.toMatchObject({
      lateFeeCharged: 0,
      depositReleased: 30000,
      payout: 6000,
    });
  });

  it('pays only the fee when the booking has no deposit', async () => {
    const { service, paid } = setup([capturedFee]);
    await expect(
      service.settle({ ...request, deposit: 0, lateFee: 4000 }, NOW),
    ).resolves.toMatchObject({ lateFeeCharged: 0, payout: 6000 });
    expect(paid).toHaveLength(1);
  });

  it('settles a deposit-only booking', async () => {
    const { service, paid } = setup([deposit]);
    await expect(service.settle(request, NOW)).resolves.toMatchObject({
      payout: 8000,
    });
    expect(paid[0][1]).toBe(OWNER_ID);
  });

  it('succeeds with no payout when the booking has nothing authorized', async () => {
    const { service, paid } = setup([]);
    await expect(
      service.settle({ ...request, deposit: 0, lateFee: 0 }, NOW),
    ).resolves.toEqual({
      bookingId: BOOKING_ID,
      lateFeeCharged: 0,
      depositReleased: 0,
      payout: 0,
    });
    expect(paid).toEqual([]);
  });

  it('returns the first reply when repeated', async () => {
    const { service, paid } = setup();
    const first = await service.settle(request, NOW);
    await expect(service.settle({ ...request }, NOW)).resolves.toEqual(first);
    expect(paid).toHaveLength(1);
  });

  it('refuses a second settlement under a new operation ID', async () => {
    const { service } = setup([capturedFee]);
    const body = { ...request, deposit: 0 };
    await service.settle(body, NOW);
    expect(
      await conflictMessage(
        service.settle({ ...body, operationId: 'again' }, NOW),
      ),
    ).toBe('The booking is already settled');
  });

  it.each([
    [
      'a fee that was not captured',
      [authorizationRow({ id: 'fee' }), deposit],
      request,
      'The fee authorization is AUTHORIZED, not CAPTURED',
    ],
    [
      'an expired fee',
      [authorizationRow({ id: 'fee', expires_at: NOW }), deposit],
      request,
      'The fee authorization is EXPIRED, not CAPTURED',
    ],
    [
      'a missing deposit authorization',
      [capturedFee],
      request,
      'The booking has no deposit authorization',
    ],
    [
      'a deposit of the wrong amount',
      [capturedFee, deposit],
      { ...request, deposit: 20000 },
      'The deposit 20000 does not match the deposit authorization of 30000',
    ],
    [
      'a deposit of 0 when one is authorized',
      [capturedFee, deposit],
      { ...request, deposit: 0 },
      'The deposit 0 does not match the deposit authorization of 30000',
    ],
    [
      'an expired deposit',
      [capturedFee, { ...deposit, expires_at: NOW }],
      request,
      'The deposit authorization has expired',
    ],
    [
      'a voided deposit',
      [capturedFee, { ...deposit, status: 'VOIDED' as const }],
      request,
      'The deposit authorization is VOIDED',
    ],
  ])('refuses %s and stores nothing', async (_case, rows, body, message) => {
    const { service, state, paid } = setup(rows);
    expect(await conflictMessage(service.settle(body, NOW))).toBe(message);
    expect(state.entries.size).toBe(0);
    expect(paid).toEqual([]);
  });
});
