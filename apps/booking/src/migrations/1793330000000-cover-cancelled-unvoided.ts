import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Widens bookings_unvoided_idx to the sweeper's whole void-retry query: FAILED bookings and
 * cancelled bookings that were CONFIRMED (they have a rental_id, so Payment holds money),
 * while holds_voided_at is null. The predicate repeats the query's condition, so PostgreSQL
 * can use the index for it.
 */
export class CoverCancelledUnvoided1793330000000 implements MigrationInterface {
  name = 'CoverCancelledUnvoided1793330000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX bookings_unvoided_idx`);
    await queryRunner.query(`
      CREATE INDEX bookings_unvoided_idx ON bookings (updated_at)
        WHERE (status = 'FAILED' OR (status = 'CANCELLED' AND rental_id IS NOT NULL))
          AND holds_voided_at IS NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX bookings_unvoided_idx`);
    await queryRunner.query(`
      CREATE INDEX bookings_unvoided_idx ON bookings (updated_at)
        WHERE status = 'FAILED' AND holds_voided_at IS NULL
    `);
  }
}
