import type { DataSource } from 'typeorm';
import { seedListingId } from './seed-data.js';
import { forEachLimited, seedListings } from './seed-listings.js';

function fakeDb() {
  const ids = new Set<string>();
  const query = vi.fn((_sql: string, params: unknown[]) => {
    const inserted: { id: string }[] = [];
    for (let i = 0; i < params.length; i += 14) {
      const id = params[i] as string;
      if (!ids.has(id)) {
        ids.add(id);
        inserted.push({ id });
      }
    }
    return Promise.resolve(inserted);
  });
  return { db: { query } as unknown as DataSource, query, ids };
}

describe('seedListings', () => {
  it('inserts every listing whose calendar was set up, in batches', async () => {
    const { db, query, ids } = fakeDb();
    const setup = vi.fn().mockResolvedValue(true);
    const result = await seedListings(db, setup, 250);
    expect(result).toEqual({ inserted: 250, calendarFailures: 0 });
    expect(setup).toHaveBeenCalledTimes(250);
    expect(query).toHaveBeenCalledTimes(3);
    expect(query.mock.calls[0][0]).toContain('ON CONFLICT (id) DO NOTHING');
    expect(ids.has(seedListingId(250))).toBe(true);
  });

  it('skips a listing whose calendar setup failed', async () => {
    const { db, ids } = fakeDb();
    const setup = vi.fn((listing: { id: string }) =>
      Promise.resolve(listing.id !== seedListingId(2)),
    );
    const result = await seedListings(db, setup, 3);
    expect(result).toEqual({ inserted: 2, calendarFailures: 1 });
    expect(ids.has(seedListingId(2))).toBe(false);
  });

  it('inserts nothing new when run again', async () => {
    const { db } = fakeDb();
    const setup = vi.fn().mockResolvedValue(true);
    await seedListings(db, setup, 5);
    await expect(seedListings(db, setup, 5)).resolves.toEqual({
      inserted: 0,
      calendarFailures: 0,
    });
  });
});

describe('forEachLimited', () => {
  it('never runs more than the limit at once', async () => {
    let running = 0;
    let peak = 0;
    const done: number[] = [];
    await forEachLimited([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 1));
      done.push(n);
      running--;
    });
    expect(peak).toBe(3);
    expect(done.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});
