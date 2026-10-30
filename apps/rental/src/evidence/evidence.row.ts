import type { EntityManager } from 'typeorm';
import type { Party } from '../rentals/rental-access.js';
import type { Condition, EvidenceStage } from './evidence-options.js';

/** A rental_evidence row as the queries below return it (snake_case). */
export interface EvidenceRow {
  id: string;
  rental_id: string;
  stage: EvidenceStage;
  recorded_by: string;
  recorder_role: Party;
  condition: Condition;
  accessories: string[];
  photos: string[];
  note: string | null;
  created_at: Date;
}

/** One party's record, as the service writes it. */
export interface NewEvidence {
  rentalId: string;
  stage: EvidenceStage;
  recordedBy: string;
  recorderRole: Party;
  condition: Condition;
  accessories: string[];
  photos: string[];
  note: string | null;
}

const EVIDENCE_COLUMNS = `id, rental_id, stage, recorded_by, recorder_role, condition,
  accessories, photos, note, created_at`;

/**
 * Inserts the record and returns it, or undefined when this person already recorded this
 * stage of the rental (the unique key decides, so two concurrent records cannot both win).
 */
export async function insertEvidence(
  tx: Pick<EntityManager, 'query'>,
  evidence: NewEvidence,
): Promise<EvidenceRow | undefined> {
  const [row] = (await tx.query(
    `INSERT INTO rental_evidence
       (rental_id, stage, recorded_by, recorder_role, condition, accessories, photos, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (rental_id, stage, recorded_by) DO NOTHING
     RETURNING ${EVIDENCE_COLUMNS}`,
    [
      evidence.rentalId,
      evidence.stage,
      evidence.recordedBy,
      evidence.recorderRole,
      evidence.condition,
      evidence.accessories,
      evidence.photos,
      evidence.note,
    ],
  )) as EvidenceRow[];
  return row;
}

/** Every record of the rental, pickup before return, oldest first within a stage. */
export async function findEvidence(
  tx: Pick<EntityManager, 'query'>,
  rentalId: string,
): Promise<EvidenceRow[]> {
  return (await tx.query(
    `SELECT ${EVIDENCE_COLUMNS} FROM rental_evidence
     WHERE rental_id = $1
     ORDER BY stage = 'RETURN', created_at, id`,
    [rentalId],
  )) as EvidenceRow[];
}
