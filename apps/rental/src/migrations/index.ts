import { CreateRentals1793310000000 } from './1793310000000-create-rentals.js';
import { CreateOutbox1793320600000 } from './1793320600000-create-outbox.js';

/**
 * Migrations for rental_db, run in order at startup. Import each migration class here.
 * Create one with a timestamped class that implements MigrationInterface (up/down with raw SQL).
 */
export const migrations: Function[] = [
  CreateRentals1793310000000,
  CreateOutbox1793320600000,
];
