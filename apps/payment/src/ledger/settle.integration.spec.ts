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
import { SettleService } from './settle.js';

const fee: AuthorizeRequest = {
  operationId: 'authorize-fee',
  bookingId: BOOKING_ID,
  payerId: RENTER_ID,
  payeeId: OWNER_ID,
  kind: 'FEE',
  amount: 6000,
};
const settle = {
  operationId: 'settle',
  bookingId: BOOKING_ID,
  deposit: 30000,
  lateFee: 8000,
};

describe.skipIf(!process.env.TEST_DATABASE_URL)('settle (PostgreSQL)', () => {
  let test: TestDatabase;
  let authorizer: AuthorizeService;
  let settler: SettleService;

  beforeAll(async () => {
    test = await createTestDatabase();
    authorizer = new AuthorizeService(test.db);
    settler = new SettleService(test.db);
  });

  afterAll(async () => {
    await test?.drop();
  });

  beforeEach(async () => {
    await authorizer.authorize(fee, NOW);
    await authorizer.authorize(
      {
        ...fee,
        operationId: 'authorize-deposit',
        kind: 'DEPOSIT',
        amount: 30000,
      },
      NOW,
    );
    await new CaptureService(test.db).capture(
      { operationId: 'capture', bookingId: BOOKING_ID, amount: 6000 },
      NOW,
    );
  });

  afterEach(async () => {
    await test.db.query(`DELETE FROM authorizations`);
    await test.db.query(`DELETE FROM ledger_entries`);
    await test.db.query(`DELETE FROM payouts`);
  });

  const deposit = async () =>
    (
      (await test.db.query(
        `SELECT status, captured_amount, released_amount
       FROM authorizations WHERE kind = 'DEPOSIT'`,
      )) as Record<string, unknown>[]
    )[0];

  const payouts = async () =>
    (await test.db.query(
      `SELECT payee_id, amount FROM payouts WHERE booking_id = $1`,
      [BOOKING_ID],
    )) as Record<string, unknown>[];

  it('splits the deposit and pays the fee plus the late fee', async () => {
    await expect(settler.settle(settle, NOW)).resolves.toEqual({
      bookingId: BOOKING_ID,
      lateFeeCharged: 8000,
      depositReleased: 22000,
      payout: 14000,
    });
    expect(await deposit()).toEqual({
      status: 'SETTLED',
      captured_amount: 8000,
      released_amount: 22000,
    });
    expect(await payouts()).toEqual([{ payee_id: OWNER_ID, amount: 14000 }]);
  });

  it('caps the late fee at the deposit', async () => {
    await expect(
      settler.settle({ ...settle, lateFee: 45000 }, NOW),
    ).resolves.toMatchObject({
      lateFeeCharged: 30000,
      depositReleased: 0,
      payout: 36000,
    });
    expect(await deposit()).toMatchObject({
      captured_amount: 30000,
      released_amount: 0,
    });
  });

  it('settles once when the same request arrives concurrently', async () => {
    const replies = await Promise.all(
      Array.from({ length: 4 }, () => settler.settle({ ...settle }, NOW)),
    );
    expect(new Set(replies.map((reply) => reply.payout))).toEqual(
      new Set([14000]),
    );
    expect(await payouts()).toHaveLength(1);
  });

  it('refuses a second settlement under another operation ID', async () => {
    await settler.settle(settle, NOW);
    await expect(
      settler.settle({ ...settle, operationId: 'again' }, NOW),
    ).rejects.toThrow('The booking is already settled');
  });
});
