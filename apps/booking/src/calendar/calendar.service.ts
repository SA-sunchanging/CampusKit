import type { AuthUser } from '@app/common';
import { status } from '@grpc/grpc-js';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  isExclusionViolation,
  parseInput,
  requireUuid,
  rpcError,
} from '../errors.js';
import {
  type DateRange,
  parseBlackouts,
  parsePeriod,
  type Period,
} from './date-range.js';

/** The most listing IDs one FilterAvailable call may carry (libs/contracts/proto/booking.proto). */
export const MAX_FILTER_IDS = 200;

/** The authoritative calendar of each listing: owner blackouts and booking reservations. */
@Injectable()
export class CalendarService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  /**
   * Creates the calendar of a listing or replaces its blackouts. The first caller becomes the
   * calendar owner; anyone else is refused. Reservations are kept; a blackout that overlaps an
   * active reservation answers ALREADY_EXISTS, and nothing changes.
   */
  async setupCalendar(
    caller: AuthUser,
    listingId: string,
    blackouts: DateRange[],
    now = new Date(),
  ): Promise<void> {
    requireUuid(listingId, 'listing_id');
    const periods = parseInput(() => parseBlackouts(blackouts, now));
    try {
      await this.db.transaction(async (tx) => {
        await tx.query(
          `INSERT INTO calendars (listing_id, owner_id) VALUES ($1, $2)
           ON CONFLICT (listing_id) DO NOTHING`,
          [listingId, caller.sub],
        );
        // The row lock serializes two setups of the same listing.
        const [calendar] = (await tx.query(
          `SELECT owner_id FROM calendars WHERE listing_id = $1 FOR UPDATE`,
          [listingId],
        )) as { owner_id: string }[];
        if (calendar.owner_id !== caller.sub) {
          throw rpcError(
            status.PERMISSION_DENIED,
            'Only the listing owner can change its calendar',
          );
        }
        await tx.query(
          `DELETE FROM calendar_blocks WHERE listing_id = $1 AND kind = 'BLACKOUT'`,
          [listingId],
        );
        await tx.query(
          `UPDATE calendars SET updated_at = now() WHERE listing_id = $1`,
          [listingId],
        );
        for (const period of periods) {
          await tx.query(
            `INSERT INTO calendar_blocks (listing_id, period, kind)
             VALUES ($1, tstzrange($2, $3, '[)'), 'BLACKOUT')`,
            [listingId, period.start, period.end],
          );
        }
      });
    } catch (err) {
      if (isExclusionViolation(err)) {
        throw rpcError(
          status.ALREADY_EXISTS,
          'A blackout overlaps a reserved period',
        );
      }
      throw err;
    }
  }

  /** Advisory: true when no active block overlaps the period. RequestBooking rechecks atomically. */
  async checkAvailability(
    listingId: string,
    range: DateRange | undefined,
  ): Promise<boolean> {
    requireUuid(listingId, 'listing_id');
    const period: Period = parseInput(() => parsePeriod(range));
    const [row] = (await this.db.query(
      `SELECT
         EXISTS (SELECT 1 FROM calendars WHERE listing_id = $1) AS found,
         NOT EXISTS (
           SELECT 1 FROM calendar_blocks
           WHERE listing_id = $1 AND released_at IS NULL
             AND period && tstzrange($2, $3, '[)')
         ) AS available`,
      [listingId, period.start, period.end],
    )) as { found: boolean; available: boolean }[];
    if (!row.found) {
      throw rpcError(status.NOT_FOUND, 'Listing has no calendar');
    }
    return row.available;
  }

  /**
   * Advisory, for search: the given listings whose calendar has no active block overlapping the
   * period, in the given order. A listing without a calendar counts as unavailable.
   */
  async filterAvailable(
    listingIds: string[],
    range: DateRange | undefined,
  ): Promise<string[]> {
    if (listingIds.length > MAX_FILTER_IDS) {
      throw rpcError(
        status.INVALID_ARGUMENT,
        `At most ${MAX_FILTER_IDS} listing_ids are allowed`,
      );
    }
    listingIds.forEach((id) => requireUuid(id, 'listing_ids'));
    const period: Period = parseInput(() => parsePeriod(range));
    if (listingIds.length === 0) {
      return [];
    }
    const rows = (await this.db.query(
      `SELECT c.listing_id FROM calendars c
       WHERE c.listing_id = ANY($1::uuid[])
         AND NOT EXISTS (
           SELECT 1 FROM calendar_blocks b
           WHERE b.listing_id = c.listing_id AND b.released_at IS NULL
             AND b.period && tstzrange($2, $3, '[)')
         )`,
      [listingIds, period.start, period.end],
    )) as { listing_id: string }[];
    const available = new Set(rows.map((row) => row.listing_id));
    return listingIds.filter((id) => available.has(id.toLowerCase()));
  }

  /**
   * Frees the dates of a CONFIRMED booking after the item is returned; Rental calls it as a
   * participant. Repeating it changes nothing. Anyone who does not take part gets NOT_FOUND.
   */
  async releaseCalendar(caller: AuthUser, bookingId: string): Promise<void> {
    requireUuid(bookingId, 'booking_id');
    await this.db.transaction(async (tx) => {
      const [booking] = (await tx.query(
        `SELECT renter_id, owner_id, status FROM bookings WHERE id = $1 FOR UPDATE`,
        [bookingId],
      )) as { renter_id: string; owner_id: string; status: string }[];
      if (
        !booking ||
        (booking.renter_id !== caller.sub && booking.owner_id !== caller.sub)
      ) {
        throw rpcError(status.NOT_FOUND, 'Booking not found');
      }
      if (booking.status !== 'CONFIRMED') {
        throw rpcError(
          status.FAILED_PRECONDITION,
          'Only a confirmed booking can release its dates',
        );
      }
      await tx.query(
        `UPDATE calendar_blocks SET released_at = now()
         WHERE booking_id = $1 AND released_at IS NULL`,
        [bookingId],
      );
    });
  }
}
