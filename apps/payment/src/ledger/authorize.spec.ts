import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  authorizationRow,
  BOOKING_ID,
  errorOf,
  type FakeLedgerState,
  fakeLedger,
  NOW,
  OWNER_ID,
  RENTER_ID,
} from '../testing/fake-ledger.js';
import type { AuthorizationRow } from './authorization.row.js';
import { type AuthorizeRequest, AuthorizeService } from './authorize.js';
import { runOperation } from './operations.js';

const request: AuthorizeRequest = {
  operationId: `booking:${BOOKING_ID}:authorize-fee`,
  bookingId: BOOKING_ID,
  payerId: RENTER_ID,
  payeeId: OWNER_ID,
  kind: 'FEE',
  amount: 6000,
};

/** Inserts like ON CONFLICT (booking_id, kind) DO NOTHING; raced simulates a concurrent insert. */
function insertHandler(raced = false) {
  return (sql: string, params: unknown[], state: FakeLedgerState) => {
    if (!sql.includes('INSERT INTO authorizations')) {
      return undefined;
    }
    if (raced) {
      return [];
    }
    const row = authorizationRow({
      id: `auth-${state.authorizations.length + 1}`,
      booking_id: params[0] as string,
      kind: params[1] as AuthorizationRow['kind'],
      payer_id: params[2] as string,
      payee_id: params[3] as string,
      amount: params[4] as number,
      expires_at: params[5] as Date,
    });
    state.authorizations.push(row);
    return [{ id: row.id, status: row.status }];
  };
}

function setup(initial: AuthorizationRow[] = [], raced = false) {
  const ledger = fakeLedger(initial, insertHandler(raced));
  return { ...ledger, service: new AuthorizeService(ledger.db) };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('AuthorizeService', () => {
  it('creates an AUTHORIZED hold that expires after 30 days', async () => {
    const { service, state } = setup();
    await expect(service.authorize(request, NOW)).resolves.toEqual({
      id: 'auth-1',
      status: 'AUTHORIZED',
    });
    expect(state.authorizations[0]).toMatchObject({
      kind: 'FEE',
      amount: 6000,
      expires_at: new Date('2026-11-28T05:00:00Z'),
    });
    expect(state.entries.get(request.operationId)).toMatchObject({
      operation: 'AUTHORIZE',
      result: { id: 'auth-1', status: 'AUTHORIZED' },
    });
  });

  it('uses PAYMENT_AUTHORIZATION_TTL_DAYS', async () => {
    vi.stubEnv('PAYMENT_AUTHORIZATION_TTL_DAYS', '7');
    const { service, state } = setup();
    await service.authorize(request, NOW);
    expect(state.authorizations[0].expires_at).toEqual(
      new Date('2026-11-05T05:00:00Z'),
    );
  });

  it('returns the same reply when the same request is repeated', async () => {
    const { service, state } = setup();
    const first = await service.authorize(request, NOW);
    await expect(service.authorize({ ...request }, NOW)).resolves.toEqual(
      first,
    );
    expect(state.authorizations).toHaveLength(1);
  });

  it.each(['2026-11-28T05:00:00Z', '2026-12-01T17:00:00Z'])(
    'refuses a return at or beyond hold expiry: %s',
    async (requiredUntil) => {
      const { service, state } = setup();
      await expect(
        service.authorize({ ...request, requiredUntil }, NOW),
      ).rejects.toThrow('The authorization must last beyond the rental return');
      expect(state.authorizations).toHaveLength(0);
      expect(state.entries.size).toBe(0);
    },
  );

  it('replays a period-aware authorization without extending its expiry', async () => {
    const { service, state } = setup();
    const body = { ...request, requiredUntil: '2026-11-04T17:00:00Z' };
    const first = await service.authorize(body, NOW);
    await expect(
      service.authorize(body, new Date('2026-11-01T05:00:00Z')),
    ).resolves.toEqual(first);
    expect(state.authorizations).toHaveLength(1);
    expect(state.authorizations[0].expires_at).toEqual(
      new Date('2026-11-28T05:00:00Z'),
    );
  });

  it('refuses an expired cached authorization instead of renewing it', async () => {
    const { service, state } = setup();
    const body = { ...request, requiredUntil: '2026-11-04T17:00:00Z' };
    await service.authorize(body, NOW);
    await expect(
      service.authorize(body, new Date('2026-11-28T05:00:00Z')),
    ).rejects.toThrow('The authorization has expired');
    expect(state.authorizations).toHaveLength(1);
    expect(state.authorizations[0].expires_at).toEqual(
      new Date('2026-11-28T05:00:00Z'),
    );
    expect(state.entries.size).toBe(1);
  });

  it('refuses a voided cached hold on a period-aware retry', async () => {
    const { service, state } = setup();
    const body = { ...request, requiredUntil: '2026-11-04T17:00:00Z' };
    await service.authorize(body, NOW);
    state.authorizations[0].status = 'VOIDED';
    await expect(service.authorize(body, NOW)).rejects.toThrow(
      'The original authorization is no longer open',
    );
    expect(state.authorizations).toHaveLength(1);
  });

  it('refuses new authorizations after a successful empty void', async () => {
    const { service, state, db } = setup();
    await runOperation(
      db,
      'VOID',
      { operationId: 'void', bookingId: BOOKING_ID },
      () => Promise.resolve({ bookingId: BOOKING_ID, voided: [] }),
    );
    await expect(service.authorize(request, NOW)).rejects.toThrow(
      'The booking has already been voided',
    );
    expect(state.authorizations).toHaveLength(0);
    expect(state.entries.size).toBe(1);
  });

  it('refuses a payer who is also the payee', async () => {
    const { service, state } = setup();
    const err = await errorOf(
      service.authorize({ ...request, payeeId: RENTER_ID }, NOW),
    );
    expect(err).toBeInstanceOf(BadRequestException);
    expect(state.queries).toEqual([]);
  });

  it('refuses a second hold of the same kind under a new operation ID', async () => {
    const { service, state } = setup([authorizationRow()]);
    const err = await errorOf(
      service.authorize({ ...request, operationId: 'other' }, NOW),
    );
    expect(err).toBeInstanceOf(ConflictException);
    expect((err as Error).message).toBe(
      'The booking already has a fee authorization',
    );
    expect(state.entries.size).toBe(0);
  });

  it('refuses when a concurrent request inserted the same kind first', async () => {
    const { service, state } = setup([], true);
    await expect(service.authorize(request, NOW)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(state.entries.size).toBe(0);
  });

  it('adds the deposit next to the fee for the same people', async () => {
    const { service, state } = setup([authorizationRow()]);
    await service.authorize(
      { ...request, operationId: 'dep', kind: 'DEPOSIT', amount: 30000 },
      NOW,
    );
    expect(state.authorizations.map((row) => row.kind)).toEqual([
      'FEE',
      'DEPOSIT',
    ]);
  });

  it('refuses a deposit between other people than the fee', async () => {
    const { service } = setup([
      authorizationRow({ payee_id: '00000000-0000-4000-8000-000000000003' }),
    ]);
    const err = await errorOf(
      service.authorize({ ...request, kind: 'DEPOSIT' }, NOW),
    );
    expect(err).toBeInstanceOf(ConflictException);
    expect((err as Error).message).toContain('different payer or payee');
  });
});
