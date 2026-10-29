import { BadRequestException, ConflictException } from '@nestjs/common';
import type { BookingClient } from '../clients/booking.client.js';
import type { ServiceResult } from '../clients/http-call.js';
import type { PaymentClient } from '../clients/payment.client.js';
import {
  BOOKING_ID,
  confirmedBooking,
  LISTING_ID,
  OWNER_ID,
  RENTER_ID,
} from '../testing/fixtures.js';
import {
  createTestDatabase,
  type TestDatabase,
} from '../testing/test-database.js';
import { PickupService } from './pickup.service.js';
import { RentalCreationService } from './rental-creation.service.js';
import type { RentalRow } from './rental.row.js';
import { ReturnService } from './return.service.js';

const renter = { sub: RENTER_ID, role: 'student' as const };
const owner = { sub: OWNER_ID, role: 'student' as const };
const call = { authorization: 'Bearer token', correlationId: 'corr-1' };
const atPickup = new Date('2026-11-01T10:00:00Z');
/** 25 hours after the period ends: two late days. */
const lateReturn = new Date('2026-11-05T18:00:00Z');

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'pickup and return (PostgreSQL)',
  () => {
    let test: TestDatabase;
    const booking = {
      getBooking: vi.fn(
        (_id: string, _call: unknown): Promise<ServiceResult<unknown>> =>
          Promise.resolve({ ok: true, value: confirmedBooking() }),
      ),
      releaseCalendar: vi.fn(
        (_id: string, _call: unknown): Promise<ServiceResult<true>> =>
          Promise.resolve({ ok: true, value: true }),
      ),
    };
    const payment = {
      capture: vi.fn(
        (_request: unknown, _call: unknown): Promise<ServiceResult<unknown>> =>
          Promise.resolve({
            ok: true,
            value: { bookingId: BOOKING_ID, capturedAmount: 6000 },
          }),
      ),
      settle: vi.fn(
        (_request: unknown, _call: unknown): Promise<ServiceResult<unknown>> =>
          Promise.resolve({ ok: true, value: { bookingId: BOOKING_ID } }),
      ),
    };
    let pickups: PickupService;
    let returns: ReturnService;
    let rentalId: string;

    beforeAll(async () => {
      test = await createTestDatabase();
      const clients = [
        booking as unknown as BookingClient,
        payment as unknown as PaymentClient,
      ] as const;
      pickups = new PickupService(test.db, ...clients);
      returns = new ReturnService(test.db, ...clients);
    });

    afterAll(async () => {
      await test?.drop();
    });

    beforeEach(async () => {
      vi.clearAllMocks();
      const created = await new RentalCreationService(test.db).create({
        bookingId: BOOKING_ID,
        listingId: LISTING_ID,
        ownerId: OWNER_ID,
        renterId: RENTER_ID,
        period: { start: '2026-11-01T17:00:00Z', end: '2026-11-04T17:00:00Z' },
        terms: { rentalFee: 6000, deposit: 30000, lateFeePerDay: 4000 },
      });
      rentalId = created.id;
    });

    afterEach(async () => {
      await test.db.query(`DELETE FROM rentals`);
    });

    const stored = async (): Promise<RentalRow> =>
      (
        (await test.db.query(`SELECT * FROM rentals WHERE id = $1`, [
          rentalId,
        ])) as RentalRow[]
      )[0];

    const wrong = (code: string) => (code === '000000' ? '111111' : '000000');

    it('commits a wrong pickup code and replaces the code at the fifth', async () => {
      const { pickup_code: code } = await stored();
      await expect(
        pickups.pickup(renter, rentalId, wrong(code), call, atPickup),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect((await stored()).pickup_attempts).toBe(1);
      for (let attempt = 2; attempt <= 5; attempt++) {
        await expect(
          pickups.pickup(renter, rentalId, wrong(code), call, atPickup),
        ).rejects.toBeInstanceOf(BadRequestException);
      }
      const after = await stored();
      expect(after.pickup_attempts).toBe(0);
      expect(after.pickup_code).toMatch(/^[0-9]{6}$/);
      expect(after.status).toBe('AWAITING_PICKUP');
    });

    it('picks up once when pickups race, and refuses a later one', async () => {
      const { pickup_code: code } = await stored();
      for (let i = 0; i < 4; i++) {
        // A slow capture lets every pickup pass the code check before one of them activates.
        payment.capture.mockImplementationOnce(
          () =>
            new Promise((resolve) =>
              setTimeout(
                () => resolve({ ok: true, value: { bookingId: BOOKING_ID } }),
                50,
              ),
            ),
        );
      }
      const replies = await Promise.all(
        Array.from({ length: 4 }, (_, i) =>
          pickups.pickup(
            renter,
            rentalId,
            code,
            call,
            new Date(atPickup.getTime() + i),
          ),
        ),
      );
      const row = await stored();
      expect(row.status).toBe('ACTIVE');
      for (const reply of replies) {
        expect(reply).toMatchObject({
          status: 'ACTIVE',
          pickedUpAt: row.picked_up_at?.toISOString(),
        });
      }
      await expect(
        pickups.pickup(renter, rentalId, code, call, atPickup),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('keeps AWAITING_PICKUP with last_error when the capture fails', async () => {
      const { pickup_code: code } = await stored();
      payment.capture.mockResolvedValueOnce({
        ok: false,
        reason: 'declined',
        message: 'The fee authorization has expired',
      });
      await expect(
        pickups.pickup(renter, rentalId, code, call, atPickup),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(await stored()).toMatchObject({
        status: 'AWAITING_PICKUP',
        pickup_code: code,
        last_error:
          'Fee capture was declined: The fee authorization has expired',
      });
    });

    it('settles a late return, retries a failed settlement and closes once', async () => {
      const { pickup_code, return_code } = await stored();
      await pickups.pickup(renter, rentalId, pickup_code, call, atPickup);
      await expect(
        returns.confirmReturn(
          owner,
          rentalId,
          wrong(return_code),
          call,
          lateReturn,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect((await stored()).return_attempts).toBe(1);

      payment.settle.mockResolvedValueOnce({
        ok: false,
        reason: 'unavailable',
        message: 'The payment service is unavailable',
      });
      const pending = await returns.confirmReturn(
        owner,
        rentalId,
        return_code,
        call,
        lateReturn,
      );
      expect(pending).toMatchObject({
        status: 'SETTLEMENT_PENDING',
        lateDays: 2,
        lateFee: 8000,
        lastError:
          'Settlement is unavailable: The payment service is unavailable',
      });

      const later = new Date('2026-11-10T00:00:00Z');
      const replies = await Promise.allSettled(
        Array.from({ length: 3 }, () =>
          returns.confirmReturn(owner, rentalId, undefined, call, later),
        ),
      );
      for (const reply of replies) {
        if (reply.status === 'fulfilled') {
          expect(reply.value.status).toBe('CLOSED');
        } else {
          expect(reply.reason).toBeInstanceOf(ConflictException);
        }
      }
      const row = await stored();
      expect(row).toMatchObject({
        status: 'CLOSED',
        returned_at: lateReturn,
        late_days: 2,
        late_fee: 8000,
        closed_at: later,
        last_error: null,
      });
      for (const [request] of payment.settle.mock.calls) {
        expect(request).toMatchObject({
          operationId: `rental:${rentalId}:settle`,
          lateFee: 8000,
        });
      }
    });
  },
);
