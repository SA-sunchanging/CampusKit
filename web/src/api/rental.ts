import type { Terms } from './booking.ts';
import { api } from './client.ts';
import type { Condition, DateRange } from './listing.ts';

// Rental calls through the gateway (role D). Types follow the gateway's Swagger page
// (tag "rentals"). Money is integer satang; times are ISO-8601 UTC.
export const RENTAL_STATUSES = [
  'AWAITING_PICKUP',
  'ACTIVE',
  'SETTLEMENT_PENDING',
  'CLOSED',
  'CANCELLED',
] as const;
export type RentalStatus = (typeof RENTAL_STATUSES)[number];

/** renter: the caller's own rentals; owner: rentals of the caller's listings. */
export type RentalRole = 'renter' | 'owner';

/** Every field is present: a time or text that is not set yet is an empty string. */
export interface Rental {
  id: string;
  bookingId: string;
  listingId: string;
  ownerId: string;
  renterId: string;
  status: RentalStatus;
  /** Half-open [start, end), copied from the booking. */
  period: DateRange;
  /** Copied from the booking. */
  terms: Terms;
  /** Six digits, shown to the owner while AWAITING_PICKUP; empty otherwise. */
  pickupCode: string;
  /** Six digits, shown to the renter while ACTIVE; empty otherwise. */
  returnCode: string;
  pickedUpAt: string;
  returnedAt: string;
  /** Set when CLOSED. */
  closedAt: string;
  /** Whole days late, fixed at the return. */
  lateDays: number;
  /** Satang, fixed at the return. */
  lateFee: number;
  /** True while ACTIVE after Rental flagged it overdue: the period ended before the return. */
  overdue: boolean;
  /** When Rental flagged it overdue; empty until then, kept after the return. */
  overdueAt: string;
  /** Satang: the late fee if the item came back now; 0 unless overdue. */
  lateFeeSoFar: number;
  /** Why the last pickup or settlement step failed; empty otherwise. */
  lastError: string;
  createdAt: string;
  updatedAt: string;
}

/** Builds "?role=...". */
export function rentalsQuery(role: RentalRole): string {
  return `?${new URLSearchParams({ role }).toString()}`;
}

/** The return body: the renter's code, or nothing when retrying a pending settlement. */
export function returnBody(code?: string): { code?: string } {
  return code ? { code } : {};
}

/** Newest first, at most 100. */
export async function listRentals(role: RentalRole): Promise<Rental[]> {
  const body = await api<{ rentals: Rental[] }>(
    `/rental/rentals${rentalsQuery(role)}`,
  );
  return body.rentals;
}

/** The renter or the owner only; anyone else gets 404. */
export function getRental(id: string): Promise<Rental> {
  return api(`/rental/rentals/${encodeURIComponent(id)}`);
}

/** Renter only: the owner's pickup code. The fee is captured and the answer is ACTIVE. */
export function confirmPickup(id: string, code: string): Promise<Rental> {
  return api(`/rental/rentals/${encodeURIComponent(id)}/pickup`, {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

/**
 * Owner only: the renter's return code while ACTIVE, or no code to retry a SETTLEMENT_PENDING
 * rental. The answer is CLOSED, or SETTLEMENT_PENDING with lastError when settling failed.
 */
export function confirmReturn(id: string, code?: string): Promise<Rental> {
  return api(`/rental/rentals/${encodeURIComponent(id)}/return`, {
    method: 'POST',
    body: JSON.stringify(returnBody(code)),
  });
}

/** PICKUP is recorded while AWAITING_PICKUP; RETURN while ACTIVE. */
export type EvidenceStage = 'PICKUP' | 'RETURN';

export const MAX_EVIDENCE_PHOTOS = 3;
export const MAX_ACCESSORIES = 20;
export const MAX_ACCESSORY_LENGTH = 60;
export const MAX_EVIDENCE_NOTE_LENGTH = 500;

/** What one party recorded at one stage. No note is an empty string. */
export interface Evidence {
  id: string;
  rentalId: string;
  stage: EvidenceStage;
  recordedBy: string;
  recorderRole: RentalRole;
  /** The listing condition codes. */
  condition: Condition;
  accessories: string[];
  /** Compressed JPEG data URLs, at most 3. */
  photos: string[];
  note: string;
  createdAt: string;
}

export interface EvidenceInput {
  stage: EvidenceStage;
  condition: Condition;
  accessories: string[];
  photos: string[];
  note?: string;
}

/** The evidence body: trimmed accessories without blanks, and the note only when written. */
export function evidenceBody(input: EvidenceInput): EvidenceInput {
  const note = input.note?.trim();
  return {
    stage: input.stage,
    condition: input.condition,
    accessories: input.accessories
      .map((item) => item.trim())
      .filter((item) => item !== ''),
    photos: input.photos,
    ...(note ? { note } : {}),
  };
}

/** The renter or the owner only: both parties' records for both stages, pickup first. */
export async function listEvidence(id: string): Promise<Evidence[]> {
  const body = await api<{ evidence: Evidence[] }>(
    `/rental/rentals/${encodeURIComponent(id)}/evidence`,
  );
  return body.evidence;
}

/** The renter or the owner, once per stage; a second record answers 409. */
export function recordEvidence(
  id: string,
  input: EvidenceInput,
): Promise<Evidence> {
  return api(`/rental/rentals/${encodeURIComponent(id)}/evidence`, {
    method: 'POST',
    body: JSON.stringify(evidenceBody(input)),
  });
}
