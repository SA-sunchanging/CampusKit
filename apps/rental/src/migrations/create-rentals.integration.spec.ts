import {
  findRental,
  findRentalByBooking,
  RENTAL_COLUMNS,
  updateRental,
} from '../rentals/rental.row.js';
import {
  createTestDatabase,
  type TestDatabase,
} from '../testing/test-database.js';

const booking = '22222222-2222-4222-8222-222222222222';
const listing = '33333333-3333-4333-8333-333333333333';
const owner = '00000000-0000-4000-8000-000000000001';
const renter = '00000000-0000-4000-8000-000000000002';

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'CreateRentals migration',
  () => {
    let test: TestDatabase;

    beforeAll(async () => {
      test = await createTestDatabase();
    });

    afterAll(async () => {
      await test?.drop();
    });

    afterEach(async () => {
      await test.db.query(`DELETE FROM rentals`);
    });

    async function insert(
      fields: Record<string, unknown> = {},
    ): Promise<string> {
      const row = {
        booking_id: booking,
        listing_id: listing,
        owner_id: owner,
        renter_id: renter,
        period_start: '2026-11-01T17:00:00Z',
        period_end: '2026-11-04T17:00:00Z',
        rental_fee: 6000,
        deposit: 30000,
        late_fee_per_day: 4000,
        pickup_code: '012345',
        return_code: '987654',
        ...fields,
      };
      const columns = Object.keys(row);
      const [inserted] = (await test.db.query(
        `INSERT INTO rentals (${columns.join(', ')})
         VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')})
         RETURNING id`,
        Object.values(row),
      )) as { id: string }[];
      return inserted.id;
    }

    it('accepts a valid rental with defaults', async () => {
      const id = await insert();
      const row = await findRental(test.db, id);
      expect(row).toMatchObject({
        id,
        booking_id: booking,
        status: 'AWAITING_PICKUP',
        period_start: new Date('2026-11-01T17:00:00Z'),
        pickup_attempts: 0,
        return_attempts: 0,
        picked_up_at: null,
        returned_at: null,
        closed_at: null,
        late_days: 0,
        late_fee: 0,
        last_error: null,
        pickup_claimed_at: null,
        reminder_sent_at: null,
        overdue_at: null,
      });
      expect(row?.created_at).toBeInstanceOf(Date);
    });

    it('accepts a CANCELLED rental and finds it by booking', async () => {
      const id = await insert({ status: 'CANCELLED' });
      await expect(
        findRentalByBooking(test.db, booking, true),
      ).resolves.toMatchObject({ id, status: 'CANCELLED' });
    });

    it('returns undefined for an unknown rental', async () => {
      await expect(
        findRental(test.db, '44444444-4444-4444-8444-444444444444'),
      ).resolves.toBeUndefined();
    });

    it.each([
      ['rentals_parties_check', { renter_id: owner }],
      ['rentals_period_check', { period_end: '2026-11-01T17:00:00Z' }],
      ['rentals_terms_check', { rental_fee: -1 }],
      ['rentals_terms_check', { deposit: -1 }],
      ['rentals_terms_check', { late_fee_per_day: -1 }],
      ['rentals_status_check', { status: 'RETURNED' }],
      ['rentals_pickup_code_check', { pickup_code: '12345' }],
      ['rentals_pickup_code_check', { pickup_code: '12345a' }],
      ['rentals_return_code_check', { return_code: '1234567' }],
      ['rentals_attempts_check', { pickup_attempts: -1 }],
      ['rentals_attempts_check', { return_attempts: -1 }],
      ['rentals_late_check', { late_days: -1 }],
      ['rentals_late_check', { late_fee: -1 }],
    ])('enforces %s', async (constraint, fields) => {
      await expect(insert(fields)).rejects.toThrow(constraint);
    });

    it('keeps one rental per booking', async () => {
      await insert();
      await expect(insert()).rejects.toThrow('rentals_booking_id_key');
    });

    it('updates conditionally and returns the row', async () => {
      const id = await insert();
      const sql = `UPDATE rentals SET status = 'ACTIVE', updated_at = now()
        WHERE id = $1 AND status = 'AWAITING_PICKUP'
        RETURNING ${RENTAL_COLUMNS}`;
      await expect(updateRental(test.db, sql, [id])).resolves.toMatchObject({
        id,
        status: 'ACTIVE',
      });
      await expect(updateRental(test.db, sql, [id])).resolves.toBeUndefined();
    });

    it('locks the rental for the transaction', async () => {
      const id = await insert();
      await test.db.transaction(async (tx) => {
        await expect(findRental(tx, id, true)).resolves.toMatchObject({ id });
      });
    });

    it('indexes rentals by renter and by owner', async () => {
      const indexes = (await test.db.query(
        `SELECT indexname, indexdef FROM pg_indexes
         WHERE schemaname = $1 AND tablename = 'rentals'`,
        [test.schema],
      )) as { indexname: string; indexdef: string }[];
      const byName = new Map(indexes.map((i) => [i.indexname, i.indexdef]));
      expect(byName.get('rentals_renter_idx')).toContain(
        '(renter_id, created_at DESC)',
      );
      expect(byName.get('rentals_owner_idx')).toContain(
        '(owner_id, created_at DESC)',
      );
    });

    it('indexes the ACTIVE rentals the sweeper still has to remind or flag', async () => {
      const indexes = (await test.db.query(
        `SELECT indexname, indexdef FROM pg_indexes
         WHERE schemaname = $1 AND tablename = 'rentals'`,
        [test.schema],
      )) as { indexname: string; indexdef: string }[];
      const byName = new Map(indexes.map((i) => [i.indexname, i.indexdef]));
      expect(byName.get('rentals_reminder_due_idx')).toMatch(
        /\(period_end\) WHERE .*'ACTIVE'.* AND \(reminder_sent_at IS NULL\)/,
      );
      expect(byName.get('rentals_overdue_due_idx')).toMatch(
        /\(period_end\) WHERE .*'ACTIVE'.* AND \(overdue_at IS NULL\)/,
      );
    });
  },
);
