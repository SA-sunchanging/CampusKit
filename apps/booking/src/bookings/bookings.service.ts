import type { AuthUser } from '@app/common';
import { status } from '@grpc/grpc-js';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, type EntityManager } from 'typeorm';
import {
  type DateRange,
  parsePeriod,
  type Period,
} from '../calendar/date-range.js';
import type { CallContext } from '../clients/call-context.js';
import { IdentityClient } from '../clients/identity.client.js';
import { ListingClient, type Quote } from '../clients/listing.client.js';
import {
  isExclusionViolation,
  parseInput,
  requireUuid,
  rpcError,
} from '../errors.js';
import {
  checkOpenRequests,
  checkRequestPeriod,
  expiresAt,
  parseRole,
  parseStatusFilter,
} from './booking-rules.js';
import { BOOKING_COLUMNS, type BookingRow } from './booking.row.js';
import {
  bookingsOf,
  expireStale,
  oneBookingOf,
  onListingOrByRenter,
} from './expiry.js';

/** ListBookings returns at most this many bookings. */
export const LIST_LIMIT = 100;

interface Reservation {
  renterId: string;
  listingId: string;
  period: Period;
  quote: Quote;
  now: Date;
}

/** Requests and reads bookings. The owner's decisions live in booking-decisions.service.ts. */
@Injectable()
export class BookingsService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly identity: IdentityClient,
    private readonly listing: ListingClient,
  ) {}

  /**
   * The caller asks for a period of a listing. Checks eligibility with Identity and gets the
   * terms from Listing, then reserves the dates atomically and returns the PENDING booking.
   * Overlapping dates answer ALREADY_EXISTS.
   */
  async request(
    caller: AuthUser,
    listingId: string,
    range: DateRange | undefined,
    call: CallContext,
    now = new Date(),
  ): Promise<BookingRow> {
    requireUuid(listingId, 'listing_id');
    const period = parseInput(() => parsePeriod(range));
    checkRequestPeriod(period, now);
    await this.identity.requireBooker(caller.sub, call);
    const quote = await this.listing.quote(listingId, period, call);
    if (quote.ownerId === caller.sub) {
      throw rpcError(
        status.PERMISSION_DENIED,
        'You cannot book your own listing',
      );
    }
    const reservation = { renterId: caller.sub, listingId, period, quote, now };
    try {
      return await this.db.transaction((tx) => this.reserve(tx, reservation));
    } catch (err) {
      if (isExclusionViolation(err)) {
        throw rpcError(status.ALREADY_EXISTS, 'The dates are already booked');
      }
      throw err;
    }
  }

  /** One booking of the caller, as renter or owner. Anyone else gets NOT_FOUND. */
  async get(
    caller: AuthUser,
    id: string,
    now = new Date(),
  ): Promise<BookingRow> {
    requireUuid(id, 'id');
    return this.db.transaction(async (tx) => {
      await expireStale(tx, oneBookingOf(id, caller.sub), now);
      const [booking] = (await tx.query(
        `SELECT ${BOOKING_COLUMNS} FROM bookings
         WHERE id = $1 AND (renter_id = $2 OR owner_id = $2)`,
        [id, caller.sub],
      )) as BookingRow[];
      if (!booking) {
        throw rpcError(status.NOT_FOUND, 'Booking not found');
      }
      return booking;
    });
  }

  /**
   * The caller's bookings as renter ("renter") or on their listings ("owner"), newest first,
   * at most LIST_LIMIT, optionally of one status.
   */
  async list(
    caller: AuthUser,
    role: string | undefined,
    statusFilter: string | undefined,
    now = new Date(),
  ): Promise<BookingRow[]> {
    const listRole = parseRole(role);
    const only = parseStatusFilter(statusFilter);
    const column = listRole === 'renter' ? 'renter_id' : 'owner_id';
    return this.db.transaction(async (tx) => {
      await expireStale(tx, bookingsOf(caller.sub, listRole), now);
      return (await tx.query(
        `SELECT ${BOOKING_COLUMNS} FROM bookings
         WHERE ${column} = $1 AND ($2::text IS NULL OR status = $2)
         ORDER BY created_at DESC, id DESC
         LIMIT $3`,
        [caller.sub, only, LIST_LIMIT],
      )) as BookingRow[];
    });
  }

  private async reserve(
    tx: EntityManager,
    r: Reservation,
  ): Promise<BookingRow> {
    // Serializes the requests of one renter, so concurrent requests cannot pass the limit.
    await tx.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
      `booking:renter:${r.renterId}`,
    ]);
    await expireStale(tx, onListingOrByRenter(r.listingId, r.renterId), r.now);
    await requireCalendar(tx, r.listingId);
    const [{ open }] = (await tx.query(
      `SELECT count(*)::int AS open FROM bookings
       WHERE renter_id = $1 AND status IN ('PENDING', 'AUTHORIZING')`,
      [r.renterId],
    )) as { open: number }[];
    checkOpenRequests(open);
    const [booking] = (await tx.query(
      `INSERT INTO bookings (id, listing_id, renter_id, owner_id, status, period,
         rental_fee, deposit, late_fee_per_day, expires_at)
       VALUES ($1, $2, $3, $4, 'PENDING', tstzrange($5, $6, '[)'), $7, $8, $9, $10)
       RETURNING ${BOOKING_COLUMNS}`,
      [
        randomUUID(),
        r.listingId,
        r.renterId,
        r.quote.ownerId,
        r.period.start,
        r.period.end,
        r.quote.rentalFee,
        r.quote.deposit,
        r.quote.lateFeePerDay,
        expiresAt(r.now, r.period.start),
      ],
    )) as BookingRow[];
    // The exclusion constraint rejects this insert when the dates overlap an active block.
    await tx.query(
      `INSERT INTO calendar_blocks (listing_id, period, kind, booking_id)
       VALUES ($1, tstzrange($2, $3, '[)'), 'RESERVATION', $4)`,
      [r.listingId, r.period.start, r.period.end, booking.id],
    );
    return booking;
  }
}

async function requireCalendar(
  tx: EntityManager,
  listingId: string,
): Promise<void> {
  const rows = (await tx.query(
    `SELECT 1 FROM calendars WHERE listing_id = $1`,
    [listingId],
  )) as unknown[];
  if (rows.length === 0) {
    throw rpcError(status.NOT_FOUND, 'Listing has no calendar');
  }
}
