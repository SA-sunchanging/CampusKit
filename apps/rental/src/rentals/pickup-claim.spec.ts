import { NOW, RENTAL_ID, rentalRow } from '../testing/fixtures.js';
import {
  claimLapsedAt,
  claimPickup,
  hasFreshClaim,
  PICKUP_CLAIM_LEASE_MS,
} from './pickup-claim.js';

describe('hasFreshClaim', () => {
  it('is false without a claim', () => {
    expect(hasFreshClaim({ pickup_claimed_at: null }, NOW)).toBe(false);
  });

  it('is true until the lease has passed', () => {
    const justInside = new Date(NOW.getTime() - PICKUP_CLAIM_LEASE_MS + 1);
    expect(hasFreshClaim({ pickup_claimed_at: justInside }, NOW)).toBe(true);
    expect(hasFreshClaim({ pickup_claimed_at: claimLapsedAt(NOW) }, NOW)).toBe(
      false,
    );
  });
});

describe('claimPickup', () => {
  it('claims only an AWAITING_PICKUP rental without a fresh claim', async () => {
    const row = rentalRow({ pickup_claimed_at: NOW });
    const query = vi.fn().mockResolvedValue([[row], 1]);
    await expect(claimPickup({ query }, RENTAL_ID, NOW)).resolves.toBe(row);
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("WHERE id = $1 AND status = 'AWAITING_PICKUP'");
    expect(sql).toContain(
      'AND (pickup_claimed_at IS NULL OR pickup_claimed_at <= $3)',
    );
    expect(params).toEqual([RENTAL_ID, NOW, claimLapsedAt(NOW)]);
  });

  it('returns undefined when another pickup or a cancellation got there first', async () => {
    const query = vi.fn().mockResolvedValue([[], 0]);
    await expect(
      claimPickup({ query }, RENTAL_ID, NOW),
    ).resolves.toBeUndefined();
  });
});
