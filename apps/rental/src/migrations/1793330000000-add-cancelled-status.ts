import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds CANCELLED: Booking cancelled the booking before the item was picked up, so the rental
 * ends without a handover. Only an AWAITING_PICKUP rental can become CANCELLED.
 * pickup_claimed_at records when a pickup claimed the rental before capturing the fee; while
 * that claim is fresh the rental cannot be cancelled, so a captured fee never stays on a
 * cancelled rental.
 */
export class AddCancelledStatus1793330000000 implements MigrationInterface {
  name = 'AddCancelledStatus1793330000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE rentals
        DROP CONSTRAINT rentals_status_check,
        ADD CONSTRAINT rentals_status_check CHECK (status IN (
          'AWAITING_PICKUP', 'ACTIVE', 'SETTLEMENT_PENDING', 'CLOSED', 'CANCELLED'
        )),
        ADD COLUMN pickup_claimed_at timestamptz
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE rentals
        DROP COLUMN pickup_claimed_at,
        DROP CONSTRAINT rentals_status_check,
        ADD CONSTRAINT rentals_status_check CHECK (status IN (
          'AWAITING_PICKUP', 'ACTIVE', 'SETTLEMENT_PENDING', 'CLOSED'
        ))
    `);
  }
}
