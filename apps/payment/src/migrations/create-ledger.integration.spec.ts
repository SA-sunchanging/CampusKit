import {
  createTestDatabase,
  type TestDatabase,
} from '../testing/test-database.js';

const booking = '22222222-2222-4222-8222-222222222222';
const renter = '00000000-0000-4000-8000-000000000002';
const owner = '00000000-0000-4000-8000-000000000001';

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'CreateLedger migration',
  () => {
    let test: TestDatabase;

    beforeAll(async () => {
      test = await createTestDatabase();
    });

    afterAll(async () => {
      await test?.drop();
    });

    function authorize(fields: Record<string, unknown> = {}) {
      const row = {
        booking_id: booking,
        kind: 'FEE',
        payer_id: renter,
        payee_id: owner,
        amount: 6000,
        status: 'AUTHORIZED',
        ...fields,
      };
      const columns = Object.keys(row);
      return test.db.query(
        `INSERT INTO authorizations (${columns.join(', ')}, expires_at)
       VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')}, now() + interval '30 days')`,
        Object.values(row),
      );
    }

    function entry(fields: Record<string, unknown> = {}) {
      const row = {
        operation_id: 'op-1',
        operation: 'AUTHORIZE',
        booking_id: booking,
        request_hash: 'hash',
        result: '{}',
        ...fields,
      };
      return test.db.query(
        `INSERT INTO ledger_entries (operation_id, operation, booking_id, request_hash, result)
       VALUES ($1, $2, $3, $4, $5)`,
        Object.values(row),
      );
    }

    afterEach(async () => {
      await test.db.query(`DELETE FROM authorizations`);
      await test.db.query(`DELETE FROM ledger_entries`);
      await test.db.query(`DELETE FROM payouts`);
    });

    it('accepts a valid authorization with defaults', async () => {
      await authorize();
      const [row] = (await test.db.query(
        `SELECT id, captured_amount, released_amount FROM authorizations`,
      )) as { id: string; captured_amount: number; released_amount: number }[];
      expect(row.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(row).toMatchObject({ captured_amount: 0, released_amount: 0 });
    });

    it.each([
      ['authorizations_kind_check', { kind: 'TIP' }],
      ['authorizations_status_check', { status: 'PENDING' }],
      ['authorizations_parties_check', { payee_id: renter }],
      ['authorizations_amount_check', { amount: 0 }],
      ['authorizations_split_check', { captured_amount: -1 }],
      ['authorizations_split_check', { released_amount: -1 }],
      [
        'authorizations_split_check',
        { captured_amount: 4000, released_amount: 2001 },
      ],
    ])('enforces %s', async (constraint, fields) => {
      await expect(authorize(fields)).rejects.toThrow(constraint);
    });

    it('keeps one authorization per booking and kind', async () => {
      await authorize();
      await authorize({ kind: 'DEPOSIT' });
      await expect(authorize()).rejects.toThrow(
        'authorizations_booking_kind_key',
      );
    });

    it('keeps one ledger entry per operation ID', async () => {
      await entry();
      await expect(entry({ operation: 'CAPTURE' })).rejects.toThrow(
        'ledger_entries_operation_id_key',
      );
    });

    it.each([
      ['ledger_entries_operation_check', { operation: 'REFUND' }],
      ['ledger_entries_operation_id_check', { operation_id: '' }],
    ])('enforces %s', async (constraint, fields) => {
      await expect(entry(fields)).rejects.toThrow(constraint);
    });

    it('keeps one payout per booking with a non-negative amount', async () => {
      const payout = (amount: number) =>
        test.db.query(
          `INSERT INTO payouts (booking_id, payee_id, amount) VALUES ($1, $2, $3)`,
          [booking, owner, amount],
        );
      await expect(payout(-1)).rejects.toThrow('payouts_amount_check');
      await payout(0);
      await expect(payout(100)).rejects.toThrow('payouts_booking_key');
    });

    it('indexes ledger entries by booking', async () => {
      const indexes = (await test.db.query(
        `SELECT indexname FROM pg_indexes WHERE schemaname = $1 AND tablename = 'ledger_entries'`,
        [test.schema],
      )) as { indexname: string }[];
      expect(indexes.map((index) => index.indexname)).toContain(
        'ledger_entries_booking_idx',
      );
    });
  },
);
