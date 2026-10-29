import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the administrator's review of student status: the student ID a student submits (PENDING),
 * when they submitted it, who reviewed it and when, and the reason for a REJECTED status.
 */
export class ReviewStudentStatus1793500200000 implements MigrationInterface {
  name = 'ReviewStudentStatus1793500200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE accounts
        ADD COLUMN student_id text,
        ADD COLUMN student_submitted_at timestamptz,
        ADD COLUMN student_reviewed_by uuid,
        ADD COLUMN student_reviewed_at timestamptz,
        ADD COLUMN student_rejection_reason text,
        ADD CONSTRAINT accounts_student_id_check
          CHECK (student_id ~ '^[0-9]{10}$'),
        ADD CONSTRAINT accounts_student_pending_check
          CHECK (student_status <> 'PENDING'
            OR (student_id IS NOT NULL AND student_submitted_at IS NOT NULL)),
        ADD CONSTRAINT accounts_student_rejected_check
          CHECK (student_status <> 'REJECTED'
            OR (student_rejection_reason IS NOT NULL AND student_reviewed_by IS NOT NULL)),
        ADD CONSTRAINT accounts_student_rejection_reason_check
          CHECK (char_length(student_rejection_reason) BETWEEN 1 AND 300),
        ADD CONSTRAINT accounts_student_reviewed_check
          CHECK ((student_reviewed_by IS NULL) = (student_reviewed_at IS NULL))
    `);
    await queryRunner.query(`
      CREATE INDEX accounts_student_queue_idx
        ON accounts (student_status, student_submitted_at)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX accounts_student_queue_idx`);
    await queryRunner.query(`
      ALTER TABLE accounts
        DROP CONSTRAINT accounts_student_reviewed_check,
        DROP CONSTRAINT accounts_student_rejection_reason_check,
        DROP CONSTRAINT accounts_student_rejected_check,
        DROP CONSTRAINT accounts_student_pending_check,
        DROP CONSTRAINT accounts_student_id_check,
        DROP COLUMN student_rejection_reason,
        DROP COLUMN student_reviewed_at,
        DROP COLUMN student_reviewed_by,
        DROP COLUMN student_submitted_at,
        DROP COLUMN student_id
    `);
  }
}
