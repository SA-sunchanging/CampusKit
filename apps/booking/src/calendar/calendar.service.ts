import type { AuthUser } from '@app/common';
import { status } from '@grpc/grpc-js';
import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectDataSource } from '@nestjs/typeorm';
import { isUUID } from 'class-validator';
import { DataSource, QueryFailedError } from 'typeorm';
import {
  CalendarInputError,
  type DateRange,
  parseBlackouts,
  parsePeriod,
  type Period,
} from './date-range.js';

const EXCLUSION_VIOLATION = '23P01';

function rpcError(code: status, message: string): RpcException {
  return new RpcException({ code, message });
}

function isExclusionViolation(err: unknown): boolean {
  return (
    err instanceof QueryFailedError &&
    (err.driverError as { code?: string }).code === EXCLUSION_VIOLATION
  );
}

function checkListingId(listingId: string): void {
  if (!isUUID(listingId ?? '')) {
    throw rpcError(status.INVALID_ARGUMENT, 'listing_id must be a UUID');
  }
}

/** Runs input parsing and turns a broken calendar rule into INVALID_ARGUMENT. */
function parseInput<T>(parse: () => T): T {
  try {
    return parse();
  } catch (err) {
    if (err instanceof CalendarInputError) {
      throw rpcError(status.INVALID_ARGUMENT, err.message);
    }
    throw err;
  }
}

/** The authoritative calendar of each listing: owner blackouts and, later, reservations. */
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
    checkListingId(listingId);
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
    checkListingId(listingId);
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
}
