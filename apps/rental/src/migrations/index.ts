import { CreateRentals1793310000000 } from './1793310000000-create-rentals.js';
import { CreateOutbox1793320600000 } from './1793320600000-create-outbox.js';
import { AddCancelledStatus1793330000000 } from './1793330000000-add-cancelled-status.js';
import { AddReminderAndOverdue1793340000000 } from './1793340000000-add-reminder-and-overdue.js';

/**
 * Migrations for rental_db, run in order at startup. Import each migration class here.
 * Create one with a timestamped class that implements MigrationInterface (up/down with raw SQL).
 */
export const migrations: Function[] = [
  CreateRentals1793310000000,
  CreateOutbox1793320600000,
  AddCancelledStatus1793330000000,
  AddReminderAndOverdue1793340000000,
];
