import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds FAILED: an approval that can no longer succeed, because Payment or Rental refused it or
 * the period started while it was still AUTHORIZING. Its dates are released when it fails.
 * holds_voided_at records when Payment voided its open holds; until then the sweeper retries.
 */
export class AddFailedStatus1793300000000 implements MigrationInterface {
  name = 'AddFailedStatus1793300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE bookings
        DROP CONSTRAINT bookings_status_check,
        ADD CONSTRAINT bookings_status_check CHECK (status IN (
          'PENDING', 'AUTHORIZING', 'CONFIRMED', 'DECLINED', 'EXPIRED', 'CANCELLED', 'FAILED'
        )),
        ADD COLUMN holds_voided_at timestamptz
    `);
    await queryRunner.query(`
      CREATE INDEX bookings_unvoided_idx ON bookings (updated_at)
        WHERE status = 'FAILED' AND holds_voided_at IS NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX bookings_unvoided_idx`);
    await queryRunner.query(`
      ALTER TABLE bookings
        DROP COLUMN holds_voided_at,
        DROP CONSTRAINT bookings_status_check,
        ADD CONSTRAINT bookings_status_check CHECK (status IN (
          'PENDING', 'AUTHORIZING', 'CONFIRMED', 'DECLINED', 'EXPIRED', 'CANCELLED'
        ))
    `);
  }
}
