import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates Payment's demo ledger. authorizations holds one row per booking and kind (the rental
 * fee and the deposit); ledger_entries holds one row per successful operation, keyed by the
 * caller's stable operation ID, so a retried request returns the stored result instead of
 * moving money twice; payouts records what the owner receives when a rental is settled.
 * Amounts are integer satang.
 */
export class CreateLedger1793300000000 implements MigrationInterface {
  name = 'CreateLedger1793300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE authorizations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        booking_id uuid NOT NULL,
        kind text NOT NULL,
        payer_id uuid NOT NULL,
        payee_id uuid NOT NULL,
        amount integer NOT NULL,
        captured_amount integer NOT NULL DEFAULT 0,
        released_amount integer NOT NULL DEFAULT 0,
        status text NOT NULL,
        expires_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT authorizations_kind_check CHECK (kind IN ('FEE', 'DEPOSIT')),
        CONSTRAINT authorizations_status_check
          CHECK (status IN ('AUTHORIZED', 'CAPTURED', 'SETTLED', 'VOIDED')),
        CONSTRAINT authorizations_parties_check CHECK (payer_id <> payee_id),
        CONSTRAINT authorizations_amount_check CHECK (amount > 0),
        CONSTRAINT authorizations_split_check CHECK (
          captured_amount >= 0 AND released_amount >= 0
          AND captured_amount + released_amount <= amount
        ),
        CONSTRAINT authorizations_booking_kind_key UNIQUE (booking_id, kind)
      )
    `);
    await queryRunner.query(`
      CREATE TABLE ledger_entries (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        operation_id text NOT NULL,
        operation text NOT NULL,
        booking_id uuid NOT NULL,
        request_hash text NOT NULL,
        result jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ledger_entries_operation_id_key UNIQUE (operation_id),
        CONSTRAINT ledger_entries_operation_id_check
          CHECK (char_length(operation_id) BETWEEN 1 AND 200),
        CONSTRAINT ledger_entries_operation_check
          CHECK (operation IN ('AUTHORIZE', 'CAPTURE', 'VOID', 'SETTLE'))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX ledger_entries_booking_idx ON ledger_entries (booking_id)`,
    );
    await queryRunner.query(`
      CREATE TABLE payouts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        booking_id uuid NOT NULL,
        payee_id uuid NOT NULL,
        amount integer NOT NULL,
        paid_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT payouts_booking_key UNIQUE (booking_id),
        CONSTRAINT payouts_amount_check CHECK (amount >= 0)
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE payouts`);
    await queryRunner.query(`DROP TABLE ledger_entries`);
    await queryRunner.query(`DROP TABLE authorizations`);
  }
}
