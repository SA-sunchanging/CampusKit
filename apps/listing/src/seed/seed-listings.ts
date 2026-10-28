import type { CallContext } from '../clients/call-context.js';
import type { DataSource } from 'typeorm';
import { type SeedListing, seedListing } from './seed-data.js';

/** Sets up one calendar as the listing owner; true on success. */
export type SetupCalendar = (listing: SeedListing) => Promise<boolean>;

const CALENDAR_CONCURRENCY = 20;
const INSERT_BATCH = 100;

export interface SeedResult {
  inserted: number;
  calendarFailures: number;
}

/** Calls `work` for every item with at most `limit` calls running at once. */
export async function forEachLimited<T>(
  items: readonly T[],
  limit: number,
  work: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (next < items.length) {
        const item = items[next++];
        await work(item);
      }
    },
  );
  await Promise.all(workers);
}

/**
 * Seeds `count` PUBLISHED listings with fixed IDs. Booking sets up each calendar first, and
 * only listings whose calendar exists are inserted, so a seeded listing is bookable like a real
 * one. Rows that already exist are left alone; running the seed again is safe.
 */
export async function seedListings(
  db: DataSource,
  setupCalendar: SetupCalendar,
  count: number,
): Promise<SeedResult> {
  const listings = Array.from({ length: count }, (_, i) => seedListing(i + 1));
  const ready: SeedListing[] = [];
  await forEachLimited(listings, CALENDAR_CONCURRENCY, async (listing) => {
    if (await setupCalendar(listing)) {
      ready.push(listing);
    }
  });
  let inserted = 0;
  for (let i = 0; i < ready.length; i += INSERT_BATCH) {
    inserted += await insertBatch(db, ready.slice(i, i + INSERT_BATCH));
  }
  return { inserted, calendarFailures: count - ready.length };
}

async function insertBatch(
  db: DataSource,
  batch: SeedListing[],
): Promise<number> {
  const columns = 14;
  const values = batch
    .map((_, row) => {
      const base = row * columns;
      const params = Array.from(
        { length: columns },
        (_, c) => `$${base + c + 1}`,
      );
      return `(${params.join(', ')}, 'PUBLISHED')`;
    })
    .join(', ');
  const params = batch.flatMap((l) => [
    l.id,
    l.ownerId,
    l.ownerName,
    l.title,
    l.category,
    l.description,
    l.condition,
    l.dailyRate,
    l.deposit,
    l.lateFeePerDay,
    l.replacementValue,
    l.maxRentalDays,
    l.pickupLocations,
    l.publishedAt,
  ]);
  const rows = (await db.query(
    `INSERT INTO listings (id, owner_id, owner_name, title, category, description, condition,
       daily_rate, deposit, late_fee_per_day, replacement_value, max_rental_days,
       pickup_locations, published_at, status)
     VALUES ${values}
     ON CONFLICT (id) DO NOTHING
     RETURNING id`,
    params,
  )) as unknown[];
  return rows.length;
}

/** The call context for acting as a seeded listing's owner. */
export function ownerCall(token: string): CallContext {
  return {
    authorization: `Bearer ${token}`,
    correlationId: 'seed-listings',
  };
}
