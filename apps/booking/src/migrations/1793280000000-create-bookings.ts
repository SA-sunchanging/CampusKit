import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the bookings. A booking keeps the terms quoted by Listing when it was requested, and
 * its reservation is the calendar_blocks row whose booking_id points to it; the exclusion
 * constraint on calendar_blocks keeps two active reservations of a listing from overlapping.
 */
export class CreateBookings1793280000000 implements MigrationInterface {
  name = 'CreateBookings1793280000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE bookings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        listing_id uuid NOT NULL REFERENCES calendars (listing_id),
        renter_id uuid NOT NULL,
        owner_id uuid NOT NULL,
        status text NOT NULL,
        period tstzrange NOT NULL,
        rental_fee integer NOT NULL,
        deposit integer NOT NULL,
        late_fee_per_day integer NOT NULL,
        decline_reason text,
        last_error text,
        rental_id text,
        expires_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT bookings_status_check CHECK (status IN (
          'PENDING', 'AUTHORIZING', 'CONFIRMED', 'DECLINED', 'EXPIRED', 'CANCELLED'
        )),
        CONSTRAINT bookings_period_check CHECK (
          NOT isempty(period)
          AND lower_inc(period) AND NOT upper_inc(period)
          AND NOT lower_inf(period) AND NOT upper_inf(period)
        ),
        CONSTRAINT bookings_terms_check
          CHECK (rental_fee >= 0 AND deposit >= 0 AND late_fee_per_day >= 0),
        CONSTRAINT bookings_parties_check CHECK (renter_id <> owner_id),
        CONSTRAINT bookings_decline_reason_check
          CHECK (decline_reason IS NULL OR char_length(decline_reason) <= 500)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX bookings_renter_idx ON bookings (renter_id, created_at)`,
    );
    await queryRunner.query(
      `CREATE INDEX bookings_owner_idx ON bookings (owner_id, created_at)`,
    );
    await queryRunner.query(`
      ALTER TABLE calendar_blocks
        ADD CONSTRAINT calendar_blocks_booking_fk
        FOREIGN KEY (booking_id) REFERENCES bookings (id)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE calendar_blocks DROP CONSTRAINT calendar_blocks_booking_fk`,
    );
    await queryRunner.query(`DROP TABLE bookings`);
  }
}
