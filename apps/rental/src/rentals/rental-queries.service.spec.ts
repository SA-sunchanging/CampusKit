import { NotFoundException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import {
  errorOf,
  OWNER_ID,
  RENTAL_ID,
  RENTER_ID,
  rentalRow,
  STRANGER_ID,
} from '../testing/fixtures.js';
import { LIST_LIMIT, RentalQueriesService } from './rental-queries.service.js';
import type { RentalRow } from './rental.row.js';

const renter = { sub: RENTER_ID, role: 'student' as const };
const owner = { sub: OWNER_ID, role: 'student' as const };
const stranger = { sub: STRANGER_ID, role: 'student' as const };

function setup(rows: RentalRow[]) {
  const query = vi.fn((_sql: string, _params: unknown[]) =>
    Promise.resolve(rows),
  );
  const service = new RentalQueriesService({ query } as unknown as DataSource);
  return { query, service };
}

describe('RentalQueriesService', () => {
  describe('list', () => {
    it.each([
      ['renter', renter, 'WHERE renter_id = $1'],
      ['owner', owner, 'WHERE owner_id = $1'],
    ] as const)(
      'lists the rentals of the %s, newest first',
      async (role, caller, where) => {
        const { service, query } = setup([rentalRow()]);
        const list = await service.list(caller, role);
        expect(list.rentals.map((rental) => rental.id)).toEqual([RENTAL_ID]);
        const [sql, params] = query.mock.calls[0];
        expect(sql).toContain(where);
        expect(sql).toContain('ORDER BY created_at DESC, id DESC');
        expect(params).toEqual([caller.sub, LIST_LIMIT]);
      },
    );

    it('shows the codes the caller holds', async () => {
      const { service } = setup([rentalRow()]);
      const list = await service.list(owner, 'owner');
      expect(list.rentals[0].pickupCode).toBe('012345');
    });
  });

  describe('get', () => {
    it.each([
      ['renter', renter, ''],
      ['owner', owner, '012345'],
    ])('shows the rental to its %s', async (_label, caller, pickupCode) => {
      const { service, query } = setup([rentalRow()]);
      const rental = await service.get(caller, RENTAL_ID);
      expect(rental).toMatchObject({ id: RENTAL_ID, pickupCode });
      expect(query.mock.calls[0][1]).toEqual([RENTAL_ID]);
    });

    it('answers 404 to someone who does not take part', async () => {
      const { service } = setup([rentalRow()]);
      const err = await errorOf(service.get(stranger, RENTAL_ID));
      expect(err).toBeInstanceOf(NotFoundException);
      expect((err as Error).message).toBe('Rental not found');
    });

    it('answers 404 for an unknown rental', async () => {
      const { service } = setup([]);
      await expect(service.get(renter, RENTAL_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('getInternal', () => {
    it('answers the people and status without codes', async () => {
      const { service } = setup([
        rentalRow({
          status: 'CLOSED',
          closed_at: new Date('2026-11-05T18:00:00Z'),
        }),
      ]);
      await expect(service.getInternal(RENTAL_ID)).resolves.toEqual({
        id: RENTAL_ID,
        bookingId: '22222222-2222-4222-8222-222222222222',
        listingId: '33333333-3333-4333-8333-333333333333',
        ownerId: OWNER_ID,
        renterId: RENTER_ID,
        status: 'CLOSED',
        closedAt: '2026-11-05T18:00:00.000Z',
      });
    });

    it('answers an empty closedAt before the rental closes', async () => {
      const { service } = setup([rentalRow()]);
      const rental = await service.getInternal(RENTAL_ID);
      expect(rental.closedAt).toBe('');
    });

    it('answers 404 for an unknown rental', async () => {
      const { service } = setup([]);
      await expect(service.getInternal(RENTAL_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
