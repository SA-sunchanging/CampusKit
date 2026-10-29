import { CreateLedger1793300000000 } from './1793300000000-create-ledger.js';

/**
 * Migrations for payment_db, run in order at startup. Import each migration class here.
 * Create one with a timestamped class that implements MigrationInterface (up/down with raw SQL).
 */
export const migrations: Function[] = [CreateLedger1793300000000];
