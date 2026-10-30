import {
  type Evidence,
  type EvidenceStage,
  MAX_ACCESSORIES,
  MAX_ACCESSORY_LENGTH,
  type RentalStatus,
} from '../../../api/rental.ts';

export const STAGES: EvidenceStage[] = ['PICKUP', 'RETURN'];

export const STAGE_TITLES: Record<EvidenceStage, string> = {
  PICKUP: 'At pickup',
  RETURN: 'At return',
};

/** The status in which Rental accepts each stage (overdue rentals are still ACTIVE). */
const OPEN_IN: Record<EvidenceStage, RentalStatus> = {
  PICKUP: 'AWAITING_PICKUP',
  RETURN: 'ACTIVE',
};

const samePerson = (a: string, b: string) =>
  a.toLowerCase() === b.toLowerCase();

export function stageOpen(stage: EvidenceStage, status: RentalStatus): boolean {
  return OPEN_IN[stage] === status;
}

/** The records of one stage, the viewer's first. */
export function stageRecords(
  records: Evidence[],
  stage: EvidenceStage,
  viewerId: string,
): Evidence[] {
  const mine = (record: Evidence) => samePerson(record.recordedBy, viewerId);
  const ofStage = records.filter((record) => record.stage === stage);
  return [...ofStage.filter(mine), ...ofStage.filter((r) => !mine(r))];
}

/** Whether the viewer can record this stage now: it is open and they have not recorded it. */
export function canRecord(
  stage: EvidenceStage,
  status: RentalStatus,
  records: Evidence[],
  viewerId: string,
): boolean {
  return (
    stageOpen(stage, status) &&
    !records.some(
      (record) =>
        record.stage === stage && samePerson(record.recordedBy, viewerId),
    )
  );
}

/** A stage is shown while it is open, and afterwards only when someone recorded it. */
export function showStage(
  stage: EvidenceStage,
  status: RentalStatus,
  records: Evidence[],
): boolean {
  return (
    stageOpen(stage, status) || records.some((record) => record.stage === stage)
  );
}

export function recorderLabel(record: Evidence, viewerId: string): string {
  if (samePerson(record.recordedBy, viewerId)) return 'You';
  return record.recorderRole === 'owner' ? 'The owner' : 'The renter';
}

/** One accessory per line; blank lines are dropped. */
export function parseAccessories(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

/** Why the accessories would be refused, or null. */
export function accessoriesProblem(accessories: string[]): string | null {
  if (accessories.length > MAX_ACCESSORIES) {
    return `List at most ${MAX_ACCESSORIES} accessories.`;
  }
  const long = accessories.find((item) => item.length > MAX_ACCESSORY_LENGTH);
  return long
    ? `Keep each accessory to ${MAX_ACCESSORY_LENGTH} characters: "${long.slice(0, 20)}..." is too long.`
    : null;
}
