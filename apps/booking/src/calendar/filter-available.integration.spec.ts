import { randomUUID } from 'node:crypto';
import {
  createTestDatabase,
  type TestDatabase,
} from '../testing/test-database.js';
import { CalendarService } from './calendar.service.js';

const OWNER_ID = randomUUID();
const DAY_1 = '2026-11-01T17:00:00Z';
const DAY_2 = '2026-11-02T17:00:00Z';
const DAY_3 = '2026-11-03T17:00:00Z';
const DAY_4 = '2026-11-04T17:00:00Z';

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'FilterAvailable (PostgreSQL)',
  () => {
    let test: TestDatabase;
    let calendar: CalendarService;

    beforeAll(async () => {
      test = await createTestDatabase();
      calendar = new CalendarService(test.db);
    });

    afterAll(async () => {
      await test?.drop();
    });

    async function listing(
      ...blocks: { start: string; end: string; releasedAt?: string }[]
    ): Promise<string> {
      const id = randomUUID();
      await test.db.query(
        `INSERT INTO calendars (listing_id, owner_id) VALUES ($1, $2)`,
        [id, OWNER_ID],
      );
      for (const block of blocks) {
        await test.db.query(
          `INSERT INTO calendar_blocks (listing_id, period, kind, released_at)
           VALUES ($1, tstzrange($2, $3, '[)'), 'BLACKOUT', $4)`,
          [id, block.start, block.end, block.releasedAt ?? null],
        );
      }
      return id;
    }

    it('keeps listings whose active blocks do not overlap the period, in order', async () => {
      const free = await listing();
      const blackedOut = await listing({ start: DAY_1, end: DAY_3 });
      const released = await listing({
        start: DAY_1,
        end: DAY_3,
        releasedAt: DAY_1,
      });
      const before = await listing({ start: DAY_1, end: DAY_2 });
      const noCalendar = randomUUID();
      await expect(
        calendar.filterAvailable(
          [released, noCalendar, blackedOut, before, free],
          { start: DAY_2, end: DAY_4 },
        ),
      ).resolves.toEqual([released, before, free]);
    });

    it('counts a reservation as a block until it is released', async () => {
      const id = await listing();
      const bookingId = randomUUID();
      await test.db.query(
        `INSERT INTO bookings (id, listing_id, renter_id, owner_id, status, period,
           rental_fee, deposit, late_fee_per_day, expires_at)
         VALUES ($1, $2, $3, $4, 'CONFIRMED', tstzrange($5, $6, '[)'), 6000, 30000, 4000, $7)`,
        [bookingId, id, randomUUID(), OWNER_ID, DAY_2, DAY_3, DAY_1],
      );
      await test.db.query(
        `INSERT INTO calendar_blocks (listing_id, period, kind, booking_id)
         VALUES ($1, tstzrange($2, $3, '[)'), 'RESERVATION', $4)`,
        [id, DAY_2, DAY_3, bookingId],
      );
      const period = { start: DAY_1, end: DAY_4 };
      await expect(calendar.filterAvailable([id], period)).resolves.toEqual([]);
      await test.db.query(
        `UPDATE calendar_blocks SET released_at = now() WHERE booking_id = $1`,
        [bookingId],
      );
      await expect(calendar.filterAvailable([id], period)).resolves.toEqual([
        id,
      ]);
    });
  },
);
