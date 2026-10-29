import type { AuthUser } from '@app/common';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { samePerson } from './rental.response.js';
import { findRental, type RentalRow } from './rental.row.js';

/** The person who must make a handover step: the renter picks up, the owner takes back. */
export type Party = 'renter' | 'owner';

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
  const isRenter = row !== undefined && samePerson(row.renter_id, caller.sub);
  const isOwner = row !== undefined && samePerson(row.owner_id, caller.sub);
  if (!row || (!isRenter && !isOwner)) {
    throw new NotFoundException('Rental not found');
  }
  if ((party === 'renter' && !isRenter) || (party === 'owner' && !isOwner)) {
    throw new ForbiddenException(refusal);
  }
  return row;
}
