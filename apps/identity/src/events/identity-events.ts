import { IDENTITY_EVENTS, type IdentityEventData } from '@app/contracts';
import { writeOutbox } from '@app/messaging';
import type { EntityManager } from 'typeorm';
import type { Account } from '../accounts/account.entity.js';

/** The producer name in every Identity event envelope. */
export const PRODUCER = 'identity';

/** The data of an Identity event, taken from the account after the change. */
export function identityEventData(account: Account): IdentityEventData {
  return { userId: account.id, studentStatus: account.studentStatus };
}

/** Tells the student, through the outbox, that an administrator verified their student status. */
export async function announceVerified(
  tx: EntityManager,
  account: Account,
  correlationId: string,
): Promise<void> {
  await writeOutbox(tx, {
    producer: PRODUCER,
    type: IDENTITY_EVENTS.verified,
    recipients: [account.id],
    correlationId,
    data: identityEventData(account),
  });
}
