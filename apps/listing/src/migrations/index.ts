import { CreateListings1793207400000 } from './1793207400000-create-listings.js';
import { CreateOutbox1793320000000 } from './1793320000000-create-outbox.js';
import { ModerateListings1793400000000 } from './1793400000000-moderate-listings.js';

/**
 * Migrations for listing_db, run in order at startup. Import each migration class here.
 * Create one with a timestamped class that implements MigrationInterface (up/down with raw SQL).
 */
export const migrations: Function[] = [
  CreateListings1793207400000,
  CreateOutbox1793320000000,
  ModerateListings1793400000000,
];
