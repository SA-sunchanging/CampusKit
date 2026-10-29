import { randomUUID } from 'node:crypto';
import type { PaymentClient } from '../clients/payment.client.js';
import type { RentalClient } from '../clients/rental.client.js';
import {
  createTestDatabase,
  type TestDatabase,
} from '../testing/test-database.js';
import { BookingCancellationService } from './booking-cancellation.service.js';
import { BookingDecisionsService } from './booking-decisions.service.js';
import { Compensation, failStartedApprovals } from './compensation.js';

const OWNER = { sub: randomUUID(), role: 'student' as const };
const call = { correlationId: 'corr-compensation' };
const now = new Date('2026-10-29T05:00:00Z');
const START = '2026-11-01T17:00:00Z';
const END = '2026-11-04T17:00:00Z';
/** The owner still has a day to answer at now. */
const EXPIRES = '2026-10-30T05:00:00Z';

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'failed approvals (PostgreSQL)',
  () => {
    let test: TestDatabase;
    const payment = {
      authorize: vi.fn(),
      voidHolds: vi.fn(),
    };
    const rental = { create: vi.fn() };
    let compensation: Compensation;
    let decisions: BookingDecisionsService;

    beforeAll(async () => {
      test = await createTestDatabase();
      compensation = new Compensation(
        test.db,
        payment as unknown as PaymentClient,
      );
      decisions = new BookingDecisionsService(
        test.db,
        payment as unknown as PaymentClient,
        rental as unknown as RentalClient,
        compensation,
      );
    });

    afterAll(async () => {
      await test?.drop();
    });

    beforeEach(() => {
      payment.authorize.mockReset().mockResolvedValue({
        ok: true,
        value: { id: 'a', status: 'AUTHORIZED' },
      });
      payment.voidHolds.mockReset().mockResolvedValue({
        ok: true,
        value: { bookingId: 'x', voided: [] },
      });
      rental.create.mockReset();
    });

    /** A listing with one reserved booking in the status, as RequestBooking leaves it. */
    async function booking(status: string): Promise<string> {
      const listingId = randomUUID();
      const id = randomUUID();
      await test.db.query(
        `INSERT INTO calendars (listing_id, owner_id) VALUES ($1, $2)`,
        [listingId, OWNER.sub],
      );
      await test.db.query(
        `INSERT INTO bookings (id, listing_id, renter_id, owner_id, status, period,
           rental_fee, deposit, late_fee_per_day, expires_at)
         VALUES ($1, $2, $3, $4, $5, tstzrange($6, $7, '[)'), 6000, 30000, 4000, $8)`,
        [id, listingId, randomUUID(), OWNER.sub, status, START, END, EXPIRES],
      );
      await test.db.query(
        `INSERT INTO calendar_blocks (listing_id, period, kind, booking_id)
         VALUES ($1, tstzrange($2, $3, '[)'), 'RESERVATION', $4)`,
        [listingId, START, END, id],
      );
      return id;
    }

    const stateOf = async (id: string) =>
      (
        (await test.db.query(
          `SELECT b.status, b.holds_voided_at IS NOT NULL AS voided,
             (SELECT count(*)::int FROM calendar_blocks c
              WHERE c.booking_id = b.id AND c.released_at IS NULL) AS held,
             (SELECT count(*)::int FROM outbox_events o
              WHERE o.envelope->>'type' = 'booking.failed'
                AND o.envelope->'data'->>'bookingId' = b.id::text) AS events
           FROM bookings b WHERE b.id = $1`,
          [id],
        )) as {
          status: string;
          voided: boolean;
          held: number;
          events: number;
        }[]
      )[0];

    it('fails a refused approval, frees the dates and voids the holds', async () => {
      const id = await booking('PENDING');
      payment.authorize.mockResolvedValueOnce({
        ok: false,
        reason: 'declined',
        message: 'No payment method',
      });
      const result = await decisions.approve(OWNER, id, call, now);
      expect(result.status).toBe('FAILED');
      expect(await stateOf(id)).toEqual({
        status: 'FAILED',
        voided: true,
        held: 0,
        events: 1,
      });
      expect(payment.voidHolds).toHaveBeenCalledWith(id, call);
    });

    it('keeps a FAILED booking unvoided until Payment answers', async () => {
      const id = await booking('PENDING');
      payment.authorize.mockResolvedValueOnce({
        ok: false,
        reason: 'declined',
        message: 'No payment method',
      });
      payment.voidHolds.mockResolvedValueOnce({
        ok: false,
        reason: 'unavailable',
        message: 'The payment service is unavailable',
      });
      await decisions.approve(OWNER, id, call, now);
      expect((await stateOf(id)).voided).toBe(false);
      expect(await compensation.unvoided()).toContain(id);
      await expect(compensation.voidHolds(id, call)).resolves.toBe(true);
      expect(await compensation.unvoided()).not.toContain(id);
    });

    it('retries the void of a cancelled CONFIRMED booking until Payment answers', async () => {
      const id = await booking('CONFIRMED');
      await test.db.query(
        `UPDATE bookings SET rental_id = 'rental-1' WHERE id = $1`,
        [id],
      );
      const rentalClient = {
        cancelByBooking: vi
          .fn()
          .mockResolvedValue({ ok: true, value: 'cancelled' }),
      };
      const cancellation = new BookingCancellationService(
        test.db,
        rentalClient as unknown as RentalClient,
        compensation,
      );
      payment.voidHolds.mockResolvedValueOnce({
        ok: false,
        reason: 'unavailable',
        message: 'The payment service is unavailable',
      });
      const renterId = (
        (await test.db.query(`SELECT renter_id FROM bookings WHERE id = $1`, [
          id,
        ])) as { renter_id: string }[]
      )[0].renter_id;
      const result = await cancellation.cancel(
        { sub: renterId, role: 'student' },
        id,
        'Plans changed',
        call,
        now,
      );
      expect(result.status).toBe('CANCELLED');
      expect(await stateOf(id)).toMatchObject({
        status: 'CANCELLED',
        voided: false,
        held: 0,
      });
      expect(await compensation.unvoided()).toContain(id);
      await expect(compensation.voidHolds(id, call)).resolves.toBe(true);
      expect(await compensation.unvoided()).not.toContain(id);
    });

    it('never retries a void for a booking cancelled while PENDING', async () => {
      const id = await booking('CANCELLED');
      expect(await compensation.unvoided()).not.toContain(id);
    });

    it('sweeps only AUTHORIZING bookings whose period has started', async () => {
      const started = await booking('AUTHORIZING');
      const confirmed = await booking('CONFIRMED');
      const failed = await test.db.transaction((tx) =>
        failStartedApprovals(tx, new Date(START), 'corr-sweep'),
      );
      expect(failed.map((row) => row.id)).toContain(started);
      expect(await stateOf(started)).toMatchObject({
        status: 'FAILED',
        held: 0,
        events: 1,
      });
      expect(await stateOf(confirmed)).toMatchObject({
        status: 'CONFIRMED',
        held: 1,
      });
    });

    it('leaves an AUTHORIZING booking alone before its period starts', async () => {
      const waiting = await booking('AUTHORIZING');
      await test.db.transaction((tx) =>
        failStartedApprovals(tx, new Date('2026-11-01T16:59:59Z'), 'corr'),
      );
      expect(await stateOf(waiting)).toMatchObject({
        status: 'AUTHORIZING',
        held: 1,
      });
    });
  },
);
