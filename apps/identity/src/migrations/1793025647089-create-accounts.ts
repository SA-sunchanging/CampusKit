import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Creates the accounts table, including the verification and payout columns later features read. */
export class CreateAccounts1793025647089 implements MigrationInterface {
  name = 'CreateAccounts1793025647089';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE accounts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email text NOT NULL,
        password_hash text NOT NULL,
        display_name text NOT NULL,
        role text NOT NULL DEFAULT 'student',
        email_verified_at timestamptz,
        student_status text NOT NULL DEFAULT 'UNSUBMITTED',
        payout_profile jsonb,
        suspended_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT accounts_email_key UNIQUE (email),
        CONSTRAINT accounts_email_lowercase CHECK (email = lower(email)),
        CONSTRAINT accounts_role_check CHECK (role IN ('student', 'admin')),
        CONSTRAINT accounts_student_status_check
          CHECK (student_status IN ('UNSUBMITTED', 'PENDING', 'VERIFIED', 'REJECTED'))
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE accounts`);
  }
}
