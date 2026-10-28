import { CATEGORIES } from '../listings/listing-options.js';
import { SEED_COUNT, seedListing, seedListingId } from './seed-data.js';

const KEYWORDS = [
  'textbook',
  'calculator',
  'racket',
  'football',
  'gown',
  'jacket',
  'guitar',
  'keyboard',
  'camera',
  'laptop',
  'drill',
  'tent',
];

describe('seedListingId', () => {
  it('pads the index into a fixed UUID', () => {
    expect(seedListingId(7)).toBe('00000000-0000-4000-9000-000000000007');
    expect(seedListingId(1500)).toBe('00000000-0000-4000-9000-000000001500');
  });
});

describe('seedListing', () => {
  const all = Array.from({ length: SEED_COUNT }, (_, i) => seedListing(i + 1));

  it('returns the same listing for the same index', () => {
    expect(seedListing(42)).toEqual(seedListing(42));
  });

  it('gives every listing a unique ID and a searchable keyword', () => {
    expect(new Set(all.map((l) => l.id)).size).toBe(SEED_COUNT);
    for (const listing of all) {
      expect(
        KEYWORDS.some((k) => listing.title.toLowerCase().includes(k)),
      ).toBe(true);
    }
  });

  it('stays within the listing rules', () => {
    for (const listing of all) {
      expect(CATEGORIES).toContain(listing.category);
      expect(listing.dailyRate).toBeGreaterThan(0);
      expect(listing.maxRentalDays).toBeGreaterThanOrEqual(1);
      expect(listing.maxRentalDays).toBeLessThanOrEqual(30);
      expect(listing.description.length).toBeGreaterThanOrEqual(10);
    }
  });

  it('spreads listings over both demo owners and every category', () => {
    expect(new Set(all.map((l) => l.ownerId)).size).toBe(2);
    expect(new Set(all.map((l) => l.category)).size).toBe(CATEGORIES.length);
  });
});
