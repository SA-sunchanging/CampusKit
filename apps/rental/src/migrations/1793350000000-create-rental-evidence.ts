import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates rental_evidence: what the owner or the renter recorded at pickup or at the return
 * (condition, accessories, up to three compressed photos as data URLs, and a note). Each party
 * records once per stage, so (rental_id, stage, recorded_by) is unique; a record is never
 * edited. The condition codes are Listing's. The unique index also serves reads by rental.
 */
export class CreateRentalEvidence1793350000000 implements MigrationInterface {
  name = 'CreateRentalEvidence1793350000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE rental_evidence (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        rental_id uuid NOT NULL REFERENCES rentals (id),
        stage text NOT NULL,
        recorded_by uuid NOT NULL,
        recorder_role text NOT NULL,
        condition text NOT NULL,
        accessories text[] NOT NULL DEFAULT '{}',
        photos text[] NOT NULL DEFAULT '{}',
        note text,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT rental_evidence_once_key UNIQUE (rental_id, stage, recorded_by),
        CONSTRAINT rental_evidence_stage_check CHECK (stage IN ('PICKUP', 'RETURN')),
        CONSTRAINT rental_evidence_role_check
          CHECK (recorder_role IN ('owner', 'renter')),
        CONSTRAINT rental_evidence_condition_check
          CHECK (condition IN ('NEW', 'LIKE_NEW', 'GOOD', 'FAIR')),
        CONSTRAINT rental_evidence_accessories_check
          CHECK (cardinality(accessories) <= 20),
        CONSTRAINT rental_evidence_photos_check CHECK (cardinality(photos) <= 3),
        CONSTRAINT rental_evidence_note_check CHECK (char_length(note) <= 500)
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE rental_evidence`);
  }
}
