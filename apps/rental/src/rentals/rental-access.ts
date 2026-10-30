import type { AuthUser } from '@app/common';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { samePerson } from './rental.response.js';
import { findRental, type RentalRow } from './rental.row.js';

/** The person who must make a handover step: the renter picks up, the owner takes back. */
export type Party = 'renter' | 'owner';

/** The caller's part in the rental, or undefined when they take no part. */
export function partyOf(row: RentalRow, callerId: string): Party | undefined {
  if (samePerson(row.renter_id, callerId)) return 'renter';
  if (samePerson(row.owner_id, callerId)) return 'owner';
  return undefined;
}

/**
 * Locks the rental for a handover step by one party. Anyone who does not take part gets 404,
 * as if the rental did not exist; the other party gets 403 with the refusal message.
 */
export async function lockForParty(
  tx: Pick<EntityManager, 'query'>,
  caller: AuthUser,
  id: string,
  party: Party,
  refusal: string,
): Promise<RentalRow> {
  const row = await findRental(tx, id, true);
  const callerParty = row && partyOf(row, caller.sub);
  if (!row || !callerParty) {
    throw new NotFoundException('Rental not found');
  }
  if (callerParty !== party) {
    throw new ForbiddenException(refusal);
  }
  return row;
}
