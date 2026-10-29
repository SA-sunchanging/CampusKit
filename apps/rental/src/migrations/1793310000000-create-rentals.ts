import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the rentals. Booking opens one rental per confirmed booking, so booking_id is unique;
 * the rental keeps the people, period and terms of the booking. Both handover codes are made at
 * creation: the owner holds pickup_code and the renter holds return_code. The attempt counters
 * count wrong codes. Money is integer satang.
 */
export class CreateRentals1793310000000 implements MigrationInterface {
  name = 'CreateRentals1793310000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE rentals (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        booking_id uuid NOT NULL,
        listing_id uuid NOT NULL,
        owner_id uuid NOT NULL,
        renter_id uuid NOT NULL,
        period_start timestamptz NOT NULL,
        period_end timestamptz NOT NULL,
        rental_fee integer NOT NULL,
        deposit integer NOT NULL,
        late_fee_per_day integer NOT NULL,
        status text NOT NULL DEFAULT 'AWAITING_PICKUP',
        pickup_code text NOT NULL,
        return_code text NOT NULL,
        pickup_attempts integer NOT NULL DEFAULT 0,
        return_attempts integer NOT NULL DEFAULT 0,
        picked_up_at timestamptz,
        returned_at timestamptz,
        closed_at timestamptz,
        late_days integer NOT NULL DEFAULT 0,
        late_fee integer NOT NULL DEFAULT 0,
        last_error text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT rentals_booking_id_key UNIQUE (booking_id),
        CONSTRAINT rentals_parties_check CHECK (renter_id <> owner_id),
        CONSTRAINT rentals_period_check CHECK (period_end > period_start),
        CONSTRAINT rentals_terms_check
          CHECK (rental_fee >= 0 AND deposit >= 0 AND late_fee_per_day >= 0),
        CONSTRAINT rentals_status_check CHECK (status IN (
          'AWAITING_PICKUP', 'ACTIVE', 'SETTLEMENT_PENDING', 'CLOSED'
        )),
        CONSTRAINT rentals_pickup_code_check CHECK (pickup_code ~ '^[0-9]{6}$'),
        CONSTRAINT rentals_return_code_check CHECK (return_code ~ '^[0-9]{6}$'),
        CONSTRAINT rentals_attempts_check
          CHECK (pickup_attempts >= 0 AND return_attempts >= 0),
        CONSTRAINT rentals_late_check CHECK (late_days >= 0 AND late_fee >= 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX rentals_renter_idx ON rentals (renter_id, created_at DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX rentals_owner_idx ON rentals (owner_id, created_at DESC)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE rentals`);
  }
}
