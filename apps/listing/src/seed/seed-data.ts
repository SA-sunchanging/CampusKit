import {
  type Category,
  CONDITIONS,
  type Condition,
  PICKUP_LOCATIONS,
  type PickupLocation,
} from '../listings/listing-options.js';

/** Enough listings for the load test target in docs/requirements.md. */
export const SEED_COUNT = 1500;

/** The demo students of Identity's seed (apps/identity/src/seed/demo-accounts.ts), by fixed ID. */
export const SEED_OWNERS = [
  { id: '00000000-0000-4000-8000-000000000001', name: 'Somchai Jaidee' },
  { id: '00000000-0000-4000-8000-000000000002', name: 'Malee Srisuk' },
] as const;

/** Each title holds one keyword that loadtest/lib.js searches for. */
const ITEMS: readonly { title: string; category: Category }[] = [
  { title: 'Calculus I textbook', category: 'BOOKS' },
  { title: 'Scientific calculator', category: 'ELECTRONICS' },
  { title: 'Badminton racket', category: 'SPORTS' },
  { title: 'Size 5 football', category: 'SPORTS' },
  { title: 'Graduation gown', category: 'CLOTHING' },
  { title: 'Rain jacket', category: 'CLOTHING' },
  { title: 'Acoustic guitar', category: 'MUSIC' },
  { title: 'MIDI keyboard', category: 'MUSIC' },
  { title: 'Mirrorless camera', category: 'ELECTRONICS' },
  { title: 'Spare laptop', category: 'ELECTRONICS' },
  { title: 'Cordless drill', category: 'TOOLS' },
  { title: 'Two-person tent', category: 'OTHER' },
];

/** The newest seeded listing is published at this time; each next one a minute earlier. */
const NEWEST = Date.parse('2026-10-01T00:00:00Z');

export interface SeedListing {
  id: string;
  ownerId: string;
  ownerName: string;
  title: string;
  category: Category;
  description: string;
  condition: Condition;
  dailyRate: number;
  deposit: number;
  lateFeePerDay: number;
  replacementValue: number;
  maxRentalDays: number;
  pickupLocations: PickupLocation[];
  publishedAt: Date;
}

/** Fixed ID of seeded listing `index` (1-based), so k6 can request any of them by ID. */
export function seedListingId(index: number): string {
  return `00000000-0000-4000-9000-${String(index).padStart(12, '0')}`;
}

/** The same listing for the same index every time, so seeding again changes nothing. */
export function seedListing(index: number): SeedListing {
  const item = ITEMS[index % ITEMS.length];
  const owner = SEED_OWNERS[index % SEED_OWNERS.length];
  const dailyRate = (10 + ((index * 7) % 90)) * 100;
  return {
    id: seedListingId(index),
    ownerId: owner.id,
    ownerName: owner.name,
    title: `${item.title} no. ${index}`,
    category: item.category,
    description: `Seeded listing for load tests: ${item.title.toLowerCase()} in working order.`,
    condition: CONDITIONS[index % CONDITIONS.length],
    dailyRate,
    deposit: dailyRate * 10,
    lateFeePerDay: dailyRate * 2,
    replacementValue: dailyRate * 40,
    maxRentalDays: 3 + (index % 12),
    pickupLocations: [PICKUP_LOCATIONS[index % PICKUP_LOCATIONS.length]],
    publishedAt: new Date(NEWEST - index * 60_000),
  };
}
