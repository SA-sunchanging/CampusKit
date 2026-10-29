import { useEffect, useState } from 'react';
import { checkAvailability } from '../../api/booking.ts';
import type { DateRange } from '../../api/listing.ts';

/** idle: no valid period yet; failed: the check itself did not work. */
export type Availability = 'idle' | 'checking' | 'free' | 'taken' | 'failed';

interface Checked {
  /** The listing and period this answer is for. */
  key: string;
  result: Availability;
}

/** Runs the advisory availability check whenever the period changes. */
export function useAvailability(
  listingId: string,
  period: DateRange | null,
): Availability {
  const start = period?.start ?? '';
  const end = period?.end ?? '';
  const key = period ? `${listingId}|${start}|${end}` : '';
  const [checked, setChecked] = useState<Checked | null>(null);

  useEffect(() => {
    if (!start || !end) return;
    let active = true;
    const answer = `${listingId}|${start}|${end}`;
    checkAvailability(listingId, { start, end })
      .then(
        (free) =>
          active &&
          setChecked({ key: answer, result: free ? 'free' : 'taken' }),
      )
      .catch(() => active && setChecked({ key: answer, result: 'failed' }));
    return () => {
      active = false;
    };
  }, [listingId, start, end]);

  if (!key) return 'idle';
  return checked?.key === key ? checked.result : 'checking';
}
