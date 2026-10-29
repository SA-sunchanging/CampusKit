import { CreateCalendar1793206984183 } from './1793206984183-create-calendar.js';
import { CreateBookings1793280000000 } from './1793280000000-create-bookings.js';
import { CreateOutbox1793280600000 } from './1793280600000-create-outbox.js';
import { AddFailedStatus1793300000000 } from './1793300000000-add-failed-status.js';
import { CoverCancelledUnvoided1793330000000 } from './1793330000000-cover-cancelled-unvoided.js';

/**
 * Migrations for booking_db, run in order at startup. Import each migration class here.
 * Create one with a timestamped class that implements MigrationInterface (up/down with raw SQL).
 */
export const migrations: Function[] = [
  CreateCalendar1793206984183,
  CreateBookings1793280000000,
  CreateOutbox1793280600000,
  AddFailedStatus1793300000000,
  CoverCancelledUnvoided1793330000000,
];
