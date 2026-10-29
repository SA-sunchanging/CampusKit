import {
  authorizationRow,
  BOOKING_ID,
  type FakeLedgerState,
  fakeLedger,
  NOW,
} from '../testing/fake-ledger.js';
import type { AuthorizationRow } from './authorization.row.js';
import { VoidService } from './void.js';

const request = { operationId: 'booking:b1:void', bookingId: BOOKING_ID };

/** Applies "SET status = 'VOIDED' ... WHERE id = ANY($1)". */
function voidHandler(sql: string, params: unknown[], state: FakeLedgerState) {
  if (!sql.includes("SET status = 'VOIDED'")) {
    return undefined;
  }
  const ids = params[0] as string[];
  const rows = state.authorizations.filter(
    (row) => ids.includes(row.id) && row.status === 'AUTHORIZED',
  );
  for (const row of rows) {
    Object.assign(row, { status: 'VOIDED', released_amount: row.amount });
  }
  return [[], rows.length];
}

function setup(initial: AuthorizationRow[]) {
  const ledger = fakeLedger(initial, voidHandler);
  return { ...ledger, service: new VoidService(ledger.db) };
}

const fee = authorizationRow({ id: 'fee' });
const deposit = authorizationRow({
  id: 'dep',
  kind: 'DEPOSIT',
  amount: 30000,
});

describe('VoidService', () => {
  it('voids every open hold and releases its amount', async () => {
    const { service, state } = setup([fee, deposit]);
    await expect(service.voidOpen(request)).resolves.toEqual({
      bookingId: BOOKING_ID,
      voided: ['FEE', 'DEPOSIT'],
    });
    expect(
      state.authorizations.map((row) => [row.status, row.released_amount]),
    ).toEqual([
      ['VOIDED', 6000],
      ['VOIDED', 30000],
    ]);
    expect(state.entries.get(request.operationId)?.operation).toBe('VOID');
  });

  it('also voids an expired hold', async () => {
    const { service } = setup([{ ...deposit, expires_at: NOW }]);
    await expect(service.voidOpen(request)).resolves.toMatchObject({
      voided: ['DEPOSIT'],
    });
  });

  it('leaves a captured fee as it is', async () => {
    const { service, state } = setup([
      { ...fee, status: 'CAPTURED', captured_amount: 6000 },
      deposit,
    ]);
    await expect(service.voidOpen(request)).resolves.toMatchObject({
      voided: ['DEPOSIT'],
    });
    expect(state.authorizations[0]).toMatchObject({
      status: 'CAPTURED',
      released_amount: 0,
    });
  });

  it('succeeds with nothing to void', async () => {
    const { service, state } = setup([]);
    await expect(service.voidOpen(request)).resolves.toEqual({
      bookingId: BOOKING_ID,
      voided: [],
    });
    expect(
      state.queries.some(({ sql }) => sql.includes('UPDATE authorizations')),
    ).toBe(false);
  });

  it('returns the first reply when repeated', async () => {
    const { service } = setup([fee]);
    const first = await service.voidOpen(request);
    await expect(service.voidOpen({ ...request })).resolves.toEqual(first);
  });
});
