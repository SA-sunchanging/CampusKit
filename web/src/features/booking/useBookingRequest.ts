import { useState } from 'react';
import { type Booking, requestBooking } from '../../api/booking.ts';
import type { DateRange } from '../../api/listing.ts';

/** Sends a booking request and keeps its state: pending, the server's error, or the sent booking. */
export function useBookingRequest(listingId: string) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<Booking | null>(null);

  /** True when Booking accepted the request. */
  async function send(period: DateRange): Promise<boolean> {
    setPending(true);
    setError(null);
    try {
      setSent(await requestBooking(listingId, period));
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    } finally {
      setPending(false);
    }
  }

  return { pending, error, sent, send, clearSent: () => setSent(null) };
}
