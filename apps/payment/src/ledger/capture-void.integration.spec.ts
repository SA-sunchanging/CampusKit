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
import { type AuthorizeRequest, AuthorizeService } from './authorize.js';
import { CaptureService } from './capture.js';
import { VoidService } from './void.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const fee: AuthorizeRequest = {
  operationId: 'authorize-fee',
  bookingId: BOOKING_ID,
  payerId: RENTER_ID,
  payeeId: OWNER_ID,
  kind: 'FEE',
  amount: 6000,
};
const deposit: AuthorizeRequest = {
  ...fee,
  operationId: 'authorize-deposit',
  kind: 'DEPOSIT',
  amount: 30000,
};
const capture = {
  operationId: 'capture-fee',
  bookingId: BOOKING_ID,
  amount: 6000,
};

interface Row {
  kind: string;
  status: string;
  captured_amount: number;
  released_amount: number;
}

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'capture and void (PostgreSQL)',
  () => {
    let test: TestDatabase;
    let authorizer: AuthorizeService;
    let capturer: CaptureService;
    let voider: VoidService;

    beforeAll(async () => {
      test = await createTestDatabase();
      authorizer = new AuthorizeService(test.db);
      capturer = new CaptureService(test.db);
      voider = new VoidService(test.db);
    });

    afterAll(async () => {
      await test?.drop();
    });

    afterEach(async () => {
      await test.db.query(`DELETE FROM authorizations`);
      await test.db.query(`DELETE FROM ledger_entries`);
    });

    const rows = async () =>
      (await test.db.query(
        `SELECT kind, status, captured_amount, released_amount
         FROM authorizations ORDER BY kind DESC`,
      )) as Row[];

    it('captures once when the same capture arrives concurrently', async () => {
      await authorizer.authorize(fee, NOW);
      const replies = await Promise.all(
        Array.from({ length: 5 }, () => capturer.capture({ ...capture }, NOW)),
      );
      expect(new Set(replies.map((reply) => JSON.stringify(reply))).size).toBe(
        1,
      );
      expect(replies[0]).toMatchObject({
        capturedAmount: 6000,
        status: 'CAPTURED',
      });
      const entries = (await test.db.query(
        `SELECT operation FROM ledger_entries WHERE operation = 'CAPTURE'`,
      )) as unknown[];
      expect(entries).toHaveLength(1);
      expect(await rows()).toEqual([
        expect.objectContaining({ status: 'CAPTURED', captured_amount: 6000 }),
      ]);
    });

    it('refuses a second capture under another operation ID', async () => {
      await authorizer.authorize(fee, NOW);
      await capturer.capture(capture, NOW);
      await expect(
        capturer.capture({ ...capture, operationId: 'again' }, NOW),
      ).rejects.toThrow('The fee authorization is CAPTURED');
    });

    it('refuses an expired authorization and stores nothing', async () => {
      await authorizer.authorize(fee, new Date(NOW.getTime() - 30 * DAY_MS));
      await expect(capturer.capture(capture, NOW)).rejects.toThrow(
        'The fee authorization has expired',
      );
      const entries = (await test.db.query(
        `SELECT 1 FROM ledger_entries WHERE operation_id = $1`,
        [capture.operationId],
      )) as unknown[];
      expect(entries).toHaveLength(0);
    });

    it('voids the open deposit and leaves the captured fee', async () => {
      await authorizer.authorize(fee, NOW);
      await authorizer.authorize(deposit, NOW);
      await capturer.capture(capture, NOW);
      const request = { operationId: 'void', bookingId: BOOKING_ID };
      await expect(voider.voidOpen(request)).resolves.toEqual({
        bookingId: BOOKING_ID,
        voided: ['DEPOSIT'],
      });
      await expect(voider.voidOpen(request)).resolves.toEqual({
        bookingId: BOOKING_ID,
        voided: ['DEPOSIT'],
      });
      expect(await rows()).toEqual([
        {
          kind: 'FEE',
          status: 'CAPTURED',
          captured_amount: 6000,
          released_amount: 0,
        },
        {
          kind: 'DEPOSIT',
          status: 'VOIDED',
          captured_amount: 0,
          released_amount: 30000,
        },
      ]);
    });
  },
);
