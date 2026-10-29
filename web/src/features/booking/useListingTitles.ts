import { useEffect, useState } from 'react';
import { getListing } from '../../api/listing.ts';
import { createTitleCache } from './titleCache.ts';

// Booking keeps only listing IDs, so the titles come from the public listing detail.
const cache = createTitleCache(async (id) => (await getListing(id)).title);

/** Titles by listing ID: a string when loaded, null when the lookup failed, absent while loading. */
export function useListingTitles(
  listingIds: string[],
): Record<string, string | null> {
  const key = [...new Set(listingIds)].sort().join(',');
  const [titles, setTitles] = useState<Record<string, string | null>>({});

  useEffect(() => {
    let active = true;
    for (const id of key.split(',').filter(Boolean)) {
      void cache.get(id).then((title) => {
        if (active) setTitles((current) => ({ ...current, [id]: title }));
      });
    }
    return () => {
      active = false;
    };
  }, [key]);

  return titles;
}
