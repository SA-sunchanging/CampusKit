import { AuthorizeService } from '../ledger/authorize.js';
import { CaptureService } from '../ledger/capture.js';
import { SettleService } from '../ledger/settle.js';
import {
  BOOKING_ID,
  NOW,
  OWNER_ID,
  RENTER_ID,
} from '../testing/fake-ledger.js';
import {
  createTestDatabase,
  type TestDatabase,
} from '../testing/test-database.js';
import { PaymentStatusService } from './payment-status.service.js';

const renter = { sub: RENTER_ID, role: 'student' as const };
const owner = { sub: OWNER_ID, role: 'student' as const };

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'payment status (PostgreSQL)',
  () => {
    let test: TestDatabase;

    beforeAll(async () => {
      test = await createTestDatabase();
    });

    afterAll(async () => {
      await test?.drop();
    });

    beforeEach(async () => {
      await test.db.query('TRUNCATE authorizations, ledger_entries, payouts');
    });

    it('follows a booking from authorization to payout', async () => {
      const status = new PaymentStatusService(test.db);
      await expect(status.forBooking(renter, BOOKING_ID, NOW)).resolves.toEqual(
        { bookingId: BOOKING_ID, authorizations: [], payout: null },
      );
      const authorizer = new AuthorizeService(test.db);
      const fee = {
        operationId: 'fee',
        bookingId: BOOKING_ID,
        payerId: RENTER_ID,
        payeeId: OWNER_ID,
        kind: 'FEE' as const,
        amount: 6000,
      };
      await authorizer.authorize(fee, NOW);
      await authorizer.authorize(
        { ...fee, operationId: 'dep', kind: 'DEPOSIT', amount: 30000 },
        NOW,
      );
      await new CaptureService(test.db).capture(
        { operationId: 'cap', bookingId: BOOKING_ID, amount: 6000 },
        NOW,
      );
      await new SettleService(test.db).settle(
        {
          operationId: 'set',
          bookingId: BOOKING_ID,
          deposit: 30000,
          lateFee: 0,
        },
        NOW,
      );
      const settled = await status.forBooking(owner, BOOKING_ID, NOW);
      expect(
        settled.authorizations.map((row) => [row.kind, row.status]),
      ).toEqual([
        ['FEE', 'CAPTURED'],
        ['DEPOSIT', 'SETTLED'],
      ]);
      expect(settled.authorizations[0].expiresAt).toBe(
        '2026-11-28T05:00:00.000Z',
      );
      expect(settled.payout).toEqual({
        amount: 6000,
        payeeId: OWNER_ID,
        paidAt: NOW.toISOString(),
      });
    });

    it('sums only the caller payouts, includes late fees and never counts a retry twice', async () => {
      const status = new PaymentStatusService(test.db);
      await expect(status.earnings(owner)).resolves.toEqual({
        totalEarned: 0,
        settledRentals: 0,
      });
      const authorizer = new AuthorizeService(test.db);
      const capture = new CaptureService(test.db);
      const settlement = new SettleService(test.db);
      const anotherOwner = '00000000-0000-4000-8000-000000000003';
      const cases = [
        {
          id: BOOKING_ID,
          payee: OWNER_ID,
          fee: 6000,
          late: 8000,
          settle: true,
        },
        {
          id: '22222222-2222-4222-8222-000000000002',
          payee: OWNER_ID,
          fee: 4000,
          late: 0,
          settle: true,
        },
        {
          id: '22222222-2222-4222-8222-000000000003',
          payee: anotherOwner,
          fee: 9000,
          late: 0,
          settle: true,
        },
        {
          id: '22222222-2222-4222-8222-000000000004',
          payee: OWNER_ID,
          fee: 2000,
          late: 0,
          settle: false,
        },
      ];
      for (const sample of cases) {
        const fee = {
          operationId: sample.id + ':fee',
          bookingId: sample.id,
          payerId: RENTER_ID,
          payeeId: sample.payee,
          kind: 'FEE' as const,
          amount: sample.fee,
        };
        await authorizer.authorize(fee, NOW);
        await authorizer.authorize(
          {
            ...fee,
            operationId: sample.id + ':deposit',
            kind: 'DEPOSIT',
            amount: 30000,
          },
          NOW,
        );
        await capture.capture(
          {
            operationId: sample.id + ':capture',
            bookingId: sample.id,
            amount: sample.fee,
          },
          NOW,
        );
        if (sample.settle) {
          const request = {
            operationId: sample.id + ':settle',
            bookingId: sample.id,
            deposit: 30000,
            lateFee: sample.late,
          };
          await settlement.settle(request, NOW);
          await settlement.settle(request, NOW);
        }
      }
      await expect(status.earnings(owner)).resolves.toEqual({
        totalEarned: 18000,
        settledRentals: 2,
      });
      await expect(status.earnings(renter)).resolves.toEqual({
        totalEarned: 0,
        settledRentals: 0,
      });
      await expect(
        status.earnings({ sub: anotherOwner, role: 'student' }),
      ).resolves.toEqual({
        totalEarned: 9000,
        settledRentals: 1,
      });
    });
  },
);
