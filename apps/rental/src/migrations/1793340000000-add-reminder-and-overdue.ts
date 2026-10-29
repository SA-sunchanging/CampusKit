import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the times the rental sweeper told people about an ACTIVE rental: reminder_sent_at when it
 * reminded the renter that the period ends soon, and overdue_at when it flagged the rental
 * overdue because the period ended before the return. Each is set once, by the statement that
 * announces it. The partial indexes hold only the ACTIVE rentals the sweeper still looks at.
 */
export class AddReminderAndOverdue1793340000000 implements MigrationInterface {
  name = 'AddReminderAndOverdue1793340000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE rentals
        ADD COLUMN reminder_sent_at timestamptz,
        ADD COLUMN overdue_at timestamptz
    `);
    await queryRunner.query(
      `CREATE INDEX rentals_reminder_due_idx ON rentals (period_end)
       WHERE status = 'ACTIVE' AND reminder_sent_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX rentals_overdue_due_idx ON rentals (period_end)
       WHERE status = 'ACTIVE' AND overdue_at IS NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX rentals_overdue_due_idx`);
    await queryRunner.query(`DROP INDEX rentals_reminder_due_idx`);
    await queryRunner.query(`
      ALTER TABLE rentals
        DROP COLUMN overdue_at,
        DROP COLUMN reminder_sent_at
    `);
  }
}
