import type { AuthUser } from '@app/common';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { type Party, partyOf } from '../rentals/rental-access.js';
import type { RentalStatus } from '../rentals/rental.entity.js';
import { findRental, type RentalRow } from '../rentals/rental.row.js';
import { checkPhotoSizes, type EvidenceStage } from './evidence-options.js';
import { EvidenceListResponse, EvidenceResponse } from './evidence.response.js';
import { findEvidence, insertEvidence } from './evidence.row.js';
import type { RecordEvidenceDto } from './record-evidence.dto.js';

/** The status in which each stage is open: pickup before the pickup, return before the return. */
const OPEN_IN: Record<EvidenceStage, RentalStatus> = {
  PICKUP: 'AWAITING_PICKUP',
  RETURN: 'ACTIVE',
};

const CLOSED_STAGE: Record<EvidenceStage, string> = {
  PICKUP: 'Pickup evidence can be recorded only while the rental awaits pickup',
  RETURN: 'Return evidence can be recorded only while the rental is active',
};

/** Why this stage cannot be recorded in this status, or undefined when it can. */
export function stageProblem(
  stage: EvidenceStage,
  status: RentalStatus,
): string | undefined {
  return status === OPEN_IN[stage] ? undefined : CLOSED_STAGE[stage];
}

/**
 * Condition evidence at pickup and at the return. Each party records once per stage and never
 * edits it; the codes do not wait for it, and nothing is deducted for damage.
 */
@Injectable()
export class EvidenceService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  /**
   * Records the caller's evidence for one stage. The rental stays locked until the record is
   * written, so a pickup or return confirmed meanwhile cannot slip between the check and it.
   */
  async record(
    caller: AuthUser,
    id: string,
    dto: RecordEvidenceDto,
  ): Promise<EvidenceResponse> {
    checkPhotoSizes(dto.photos);
    return this.db.transaction(async (tx) => {
      const { row, party } = await participantOf(tx, caller, id, true);
      const problem = stageProblem(dto.stage, row.status);
      if (problem) {
        throw new ConflictException(problem);
      }
      const saved = await insertEvidence(tx, {
        rentalId: row.id,
        stage: dto.stage,
        recordedBy: caller.sub,
        recorderRole: party,
        condition: dto.condition,
        accessories: dto.accessories,
        photos: dto.photos,
        note: dto.note || null,
      });
      if (!saved) {
        throw new ConflictException(
          `You already recorded the ${dto.stage.toLowerCase()} evidence`,
        );
      }
      return EvidenceResponse.of(saved);
    });
  }

  /** Both parties' records for both stages, in any status. */
  async list(caller: AuthUser, id: string): Promise<EvidenceListResponse> {
    const { row } = await participantOf(this.db, caller, id, false);
    return EvidenceListResponse.of(await findEvidence(this.db, row.id));
  }
}

/** The rental and the caller's part in it; anyone who takes no part gets 404. */
async function participantOf(
  tx: Pick<DataSource, 'query'>,
  caller: AuthUser,
  id: string,
  lock: boolean,
): Promise<{ row: RentalRow; party: Party }> {
  const row = await findRental(tx, id, lock);
  const party = row && partyOf(row, caller.sub);
  if (!row || !party) {
    throw new NotFoundException('Rental not found');
  }
  return { row, party };
}
