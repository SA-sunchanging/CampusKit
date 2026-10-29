import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the pending email verification codes: at most one per account, stored only as a hash.
 * A row disappears when the account confirms its email or is deleted.
 */
export class CreateEmailVerifications1793500000000 implements MigrationInterface {
  name = 'CreateEmailVerifications1793500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE email_verifications (
        account_id uuid PRIMARY KEY REFERENCES accounts (id) ON DELETE CASCADE,
        code_hash text NOT NULL,
        expires_at timestamptz NOT NULL,
        attempts integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT email_verifications_attempts_check CHECK (attempts >= 0),
        CONSTRAINT email_verifications_expiry_check CHECK (expires_at > created_at)
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE email_verifications`);
  }
}
