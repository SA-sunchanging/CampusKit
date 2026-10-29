import { randomUUID } from 'node:crypto';
import { isExclusionViolation } from '../errors.js';
import {
  createTestDatabase,
  type TestDatabase,
} from '../testing/test-database.js';

const OWNER_ID = '00000000-0000-4000-8000-000000000001';
const DAY_1 = '2026-11-01T17:00:00Z';
const DAY_2 = '2026-11-02T17:00:00Z';
const DAY_3 = '2026-11-03T17:00:00Z';
const DAY_4 = '2026-11-04T17:00:00Z';

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'calendar_blocks constraints (PostgreSQL)',
  () => {
    let test: TestDatabase;
    let listingId: string;

    beforeAll(async () => {
      test = await createTestDatabase();
    });

    afterAll(async () => {
      await test?.drop();
    });

    beforeEach(async () => {
      listingId = randomUUID();
      await test.db.query(
        `INSERT INTO calendars (listing_id, owner_id) VALUES ($1, $2)`,
        [listingId, OWNER_ID],
      );
    });

    const block = (start: string, end: string, bounds = '[)') =>
      test.db.query(
        `INSERT INTO calendar_blocks (listing_id, period, kind)
         VALUES ($1, tstzrange($2, $3, $4), 'BLACKOUT') RETURNING id`,
        [listingId, start, end, bounds],
      ) as Promise<{ id: string }[]>;

    const failure = (promise: Promise<unknown>) =>
      promise.then(
        () => undefined,
        (err: unknown) => err,
      );

    it('refuses two active blocks that overlap', async () => {
      await block(DAY_1, DAY_3);
      const err = await failure(block(DAY_2, DAY_4));
      expect(isExclusionViolation(err)).toBe(true);
    });

    it('accepts blocks that only touch, because ranges are half-open', async () => {
      await block(DAY_1, DAY_2);
      await expect(block(DAY_2, DAY_3)).resolves.toHaveLength(1);
    });

    it('accepts the same dates on another listing', async () => {
      await block(DAY_1, DAY_3);
      const other = randomUUID();
      await test.db.query(
        `INSERT INTO calendars (listing_id, owner_id) VALUES ($1, $2)`,
        [other, OWNER_ID],
      );
      await expect(
        test.db.query(
          `INSERT INTO calendar_blocks (listing_id, period, kind)
           VALUES ($1, tstzrange($2, $3, '[)'), 'BLACKOUT')`,
          [other, DAY_1, DAY_3],
        ),
      ).resolves.toBeDefined();
    });

    it('frees the dates once a block is released', async () => {
      const [first] = await block(DAY_1, DAY_3);
      await test.db.query(
        `UPDATE calendar_blocks SET released_at = now() WHERE id = $1`,
        [first.id],
      );
      await expect(block(DAY_1, DAY_3)).resolves.toHaveLength(1);
    });

    it('refuses closed and unbounded periods', async () => {
      await expect(block(DAY_1, DAY_2, '[]')).rejects.toThrow(
        /calendar_blocks_period_check/,
      );
      await expect(
        test.db.query(
          `INSERT INTO calendar_blocks (listing_id, period, kind)
           VALUES ($1, tstzrange($2, NULL, '[)'), 'BLACKOUT')`,
          [listingId, DAY_1],
        ),
      ).rejects.toThrow(/calendar_blocks_period_check/);
    });

    it('refuses a reservation without a booking', async () => {
      await expect(
        test.db.query(
          `INSERT INTO calendar_blocks (listing_id, period, kind)
           VALUES ($1, tstzrange($2, $3, '[)'), 'RESERVATION')`,
          [listingId, DAY_1, DAY_2],
        ),
      ).rejects.toThrow(/calendar_blocks_booking_check/);
    });
  },
);
