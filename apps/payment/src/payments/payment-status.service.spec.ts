import {
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { DataSource } from 'typeorm';
import type { AuthorizationRow } from '../ledger/authorization.row.js';
import {
  authorizationRow,
  BOOKING_ID,
  NOW,
  OWNER_ID,
  RENTER_ID,
} from '../testing/fake-ledger.js';
import { PaymentStatusService } from './payment-status.service.js';

const renter = { sub: RENTER_ID, role: 'student' as const };
const owner = { sub: OWNER_ID, role: 'student' as const };
const stranger = {
  sub: '00000000-0000-4000-8000-000000000003',
  role: 'student' as const,
};
const paidAt = new Date('2026-11-05T05:00:00Z');

function setup(rows: AuthorizationRow[], payouts: unknown[] = []) {
  const db = {
    query: vi.fn((sql: string) =>
      Promise.resolve(sql.includes('FROM payouts') ? payouts : rows),
    ),
  };
  return { db, service: new PaymentStatusService(db as unknown as DataSource) };
}

const fee = authorizationRow({
  id: 'fee',
  status: 'CAPTURED',
  captured_amount: 6000,
});
const deposit = authorizationRow({
  id: 'dep',
  kind: 'DEPOSIT',
  amount: 30000,
});

describe('PaymentStatusService', () => {
  it('answers an empty status when nothing is authorized', async () => {
    const { service, db } = setup([]);
    await expect(
      service.forBooking(stranger, BOOKING_ID, NOW),
    ).resolves.toEqual({
      bookingId: BOOKING_ID,
      authorizations: [],
      payout: null,
    });
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  it('shows the holds to the renter, FEE first, with no payout yet', async () => {
    const { service, db } = setup([fee, deposit]);
    const status = await service.forBooking(renter, BOOKING_ID, NOW);
    expect(db.query.mock.calls[0][0]).toContain('ORDER BY kind DESC');
    expect(status).toEqual({
      bookingId: BOOKING_ID,
      authorizations: [
        {
          id: 'fee',
          kind: 'FEE',
          amount: 6000,
          capturedAmount: 6000,
          releasedAmount: 0,
          status: 'CAPTURED',
          expiresAt: '2026-11-28T05:00:00.000Z',
        },
        expect.objectContaining({ kind: 'DEPOSIT', status: 'AUTHORIZED' }),
      ],
      payout: null,
    });
  });

  it('reports an AUTHORIZED hold past its expiry as EXPIRED', async () => {
    const { service } = setup([{ ...deposit, expires_at: NOW }]);
    const status = await service.forBooking(owner, BOOKING_ID, NOW);
    expect(status.authorizations[0].status).toBe('EXPIRED');
  });

  it('shows the payout to the owner', async () => {
    const { service } = setup(
      [fee, { ...deposit, status: 'SETTLED' }],
      [{ amount: 14000, payee_id: OWNER_ID, paid_at: paidAt }],
    );
    const status = await service.forBooking(owner, BOOKING_ID, NOW);
    expect(status.payout).toEqual({
      amount: 14000,
      payeeId: OWNER_ID,
      paidAt: '2026-11-05T05:00:00.000Z',
    });
  });

  it('answers 404 to someone who does not take part', async () => {
    const { service } = setup([fee]);
    await expect(
      service.forBooking(stranger, BOOKING_ID, NOW),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('PaymentStatusService.earnings', () => {
  it.each([
    { total_earned: '0', settled_rentals: 0 },
    { total_earned: '12550', settled_rentals: 2 },
  ])('returns settled earnings %j scoped to the caller', async (row) => {
    const { service, db } = setup([], [row]);
    await expect(service.earnings(owner)).resolves.toEqual({
      totalEarned: Number(row.total_earned),
      settledRentals: row.settled_rentals,
    });
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM payouts WHERE payee_id = $1'),
      [OWNER_ID],
    );
  });

  it('refuses totals that cannot be represented accurately', async () => {
    const { service } = setup(
      [],
      [{ total_earned: '9007199254740992', settled_rentals: 2 }],
    );
    await expect(service.earnings(owner)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });

  it('rejects administrators before querying payments', async () => {
    const { service, db } = setup([]);
    await expect(
      service.earnings({ ...owner, role: 'admin' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.query).not.toHaveBeenCalled();
  });
});
