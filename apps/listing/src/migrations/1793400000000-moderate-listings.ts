import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds moderation and unpublishing. A flagged listing waits in PENDING_REVIEW until an
 * administrator approves it (PUBLISHED) or rejects it (REJECTED, with a reason); the owner can
 * take a PUBLISHED listing down (UNPUBLISHED). published_at means "was published", so it is set
 * exactly when the status is PUBLISHED or UNPUBLISHED. The index serves the review queue,
 * oldest first.
 */
export class ModerateListings1793400000000 implements MigrationInterface {
  name = 'ModerateListings1793400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE listings
        ADD COLUMN moderation_flags text[] NOT NULL DEFAULT '{}',
        ADD COLUMN rejection_reason text,
        ADD COLUMN reviewed_by uuid,
        ADD COLUMN reviewed_at timestamptz,
        ADD COLUMN unpublished_at timestamptz,
        DROP CONSTRAINT listings_status_check,
        ADD CONSTRAINT listings_status_check CHECK (status IN (
          'DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'UNPUBLISHED'
        )),
        DROP CONSTRAINT listings_published_check,
        ADD CONSTRAINT listings_published_check CHECK (
          (status IN ('PUBLISHED', 'UNPUBLISHED')) = (published_at IS NOT NULL)
        ),
        ADD CONSTRAINT listings_unpublished_check CHECK (
          (status = 'UNPUBLISHED') = (unpublished_at IS NOT NULL)
        ),
        ADD CONSTRAINT listings_rejected_check CHECK (
          (status = 'REJECTED') = (rejection_reason IS NOT NULL)
          AND (status <> 'REJECTED' OR reviewed_at IS NOT NULL)
        ),
        ADD CONSTRAINT listings_rejection_reason_check CHECK (
          char_length(rejection_reason) BETWEEN 1 AND 300
        ),
        ADD CONSTRAINT listings_reviewed_check CHECK (
          (reviewed_by IS NULL) = (reviewed_at IS NULL)
        )
    `);
    await queryRunner.query(`
      CREATE INDEX listings_review_queue_idx ON listings (status, created_at)
    `);
  }

  /** Fails while any listing is in one of the new statuses. */
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX listings_review_queue_idx`);
    await queryRunner.query(`
      ALTER TABLE listings
        DROP CONSTRAINT listings_reviewed_check,
        DROP CONSTRAINT listings_rejection_reason_check,
        DROP CONSTRAINT listings_rejected_check,
        DROP CONSTRAINT listings_unpublished_check,
        DROP CONSTRAINT listings_published_check,
        DROP CONSTRAINT listings_status_check,
        DROP COLUMN unpublished_at,
        DROP COLUMN reviewed_at,
        DROP COLUMN reviewed_by,
        DROP COLUMN rejection_reason,
        DROP COLUMN moderation_flags,
        ADD CONSTRAINT listings_status_check CHECK (status IN ('DRAFT', 'PUBLISHED')),
        ADD CONSTRAINT listings_published_check CHECK (
          (status = 'PUBLISHED') = (published_at IS NOT NULL)
        )
    `);
  }
}
