import { LISTING_EVENTS, type ListingEventData } from '@app/contracts';
import { writeOutbox } from '@app/messaging';
import type { EntityManager } from 'typeorm';
import type { Listing } from './listing.entity.js';

/** The producer name in every Listing event envelope. */
export const PRODUCER = 'listing';

/** The data of a Listing event, taken from the listing after the change. */
export function listingEventData(listing: Listing): ListingEventData {
  return {
    listingId: listing.id,
    ownerId: listing.ownerId,
    title: listing.title,
    status: listing.status,
  };
}

/** Tells the owner, through the outbox, that the listing is published. */
export async function announcePublished(
  tx: EntityManager,
  listing: Listing,
  correlationId: string,
): Promise<void> {
  await writeOutbox(tx, {
    producer: PRODUCER,
    type: LISTING_EVENTS.published,
    recipients: [listing.ownerId],
    correlationId,
    data: listingEventData(listing),
  });
}
