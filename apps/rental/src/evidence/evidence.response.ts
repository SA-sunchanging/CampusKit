import { ApiProperty } from '@nestjs/swagger';
import type { Party } from '../rentals/rental-access.js';
import {
  CONDITIONS,
  type Condition,
  EVIDENCE_STAGES,
  type EvidenceStage,
} from './evidence-options.js';
import type { EvidenceRow } from './evidence.row.js';

/** What one party recorded at one stage. Every field is present; no note is an empty string. */
export class EvidenceResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  rentalId: string;

  @ApiProperty({ enum: EVIDENCE_STAGES })
  stage: EvidenceStage;

  @ApiProperty({ format: 'uuid' })
  recordedBy: string;

  @ApiProperty({ enum: ['owner', 'renter'] })
  recorderRole: Party;

  @ApiProperty({ enum: CONDITIONS })
  condition: Condition;

  @ApiProperty({ type: [String] })
  accessories: string[];

  @ApiProperty({ type: [String], description: 'Data URLs.' })
  photos: string[];

  @ApiProperty()
  note: string;

  @ApiProperty({ example: '2026-11-01T10:00:00.000Z' })
  createdAt: string;

  static of(row: EvidenceRow): EvidenceResponse {
    return {
      id: row.id,
      rentalId: row.rental_id,
      stage: row.stage,
      recordedBy: row.recorded_by,
      recorderRole: row.recorder_role,
      condition: row.condition,
      accessories: row.accessories,
      photos: row.photos,
      note: row.note ?? '',
      createdAt: row.created_at.toISOString(),
    };
  }
}

/** Both parties' records for both stages, pickup first. */
export class EvidenceListResponse {
  @ApiProperty({ type: [EvidenceResponse] })
  evidence: EvidenceResponse[];

  static of(rows: EvidenceRow[]): EvidenceListResponse {
    return { evidence: rows.map((row) => EvidenceResponse.of(row)) };
  }
}
