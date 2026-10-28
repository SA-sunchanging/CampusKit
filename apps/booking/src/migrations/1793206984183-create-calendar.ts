import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the calendar of each listing. Every blocked period is one row in calendar_blocks:
 * owner blackouts and booking reservations. The exclusion constraint makes two active blocks
 * of the same listing overlap impossible, even under concurrent requests
 * (docs/adr/adr-003-prevent-overlapping-reservations-with-database-constraints.md).
 * btree_gist is installed by infra/postgres/init.sql.
 */
export class CreateCalendar1793206984183 implements MigrationInterface {
  name = 'CreateCalendar1793206984183';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE calendars (
        listing_id uuid PRIMARY KEY,
        owner_id uuid NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE calendar_blocks (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        listing_id uuid NOT NULL REFERENCES calendars (listing_id) ON DELETE CASCADE,
        period tstzrange NOT NULL,
        kind text NOT NULL,
        booking_id uuid,
        released_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT calendar_blocks_kind_check CHECK (kind IN ('BLACKOUT', 'RESERVATION')),
        CONSTRAINT calendar_blocks_booking_check
          CHECK ((kind = 'RESERVATION') = (booking_id IS NOT NULL)),
        CONSTRAINT calendar_blocks_period_check CHECK (
          NOT isempty(period)
          AND lower_inc(period) AND NOT upper_inc(period)
          AND NOT lower_inf(period) AND NOT upper_inf(period)
        ),
        CONSTRAINT calendar_blocks_no_overlap
          EXCLUDE USING gist (listing_id WITH =, period WITH &&)
          WHERE (released_at IS NULL)
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX calendar_blocks_booking_key
        ON calendar_blocks (booking_id) WHERE booking_id IS NOT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE calendar_blocks`);
    await queryRunner.query(`DROP TABLE calendars`);
  }
}
