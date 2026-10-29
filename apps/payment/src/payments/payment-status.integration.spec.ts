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
  },
);
