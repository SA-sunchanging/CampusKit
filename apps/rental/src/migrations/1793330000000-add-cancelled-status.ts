import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds CANCELLED: Booking cancelled the booking before the item was picked up, so the rental
 * ends without a handover. Only an AWAITING_PICKUP rental can become CANCELLED.
 */
export class AddCancelledStatus1793330000000 implements MigrationInterface {
  name = 'AddCancelledStatus1793330000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE rentals
        DROP CONSTRAINT rentals_status_check,
        ADD CONSTRAINT rentals_status_check CHECK (status IN (
          'AWAITING_PICKUP', 'ACTIVE', 'SETTLEMENT_PENDING', 'CLOSED', 'CANCELLED'
        ))
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE rentals
        DROP CONSTRAINT rentals_status_check,
        ADD CONSTRAINT rentals_status_check CHECK (status IN (
          'AWAITING_PICKUP', 'ACTIVE', 'SETTLEMENT_PENDING', 'CLOSED'
        ))
    `);
  }
}
