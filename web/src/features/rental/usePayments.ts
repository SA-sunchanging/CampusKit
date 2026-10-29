import { useEffect, useState } from 'react';
import { getBookingPayments, type PaymentStatus } from '../../api/payment.ts';

export interface LoadedPayments {
  /** The booking this answer is for. */
  bookingId: string;
  payments?: PaymentStatus;
  error?: string;
}

/**
 * The booking's payment status, or null while it loads. It loads again whenever `version`
 * changes and keeps showing the previous answer until the new one arrives.
 */
export function usePayments(
  bookingId: string,
  version: number,
): LoadedPayments | null {
  const [loaded, setLoaded] = useState<LoadedPayments | null>(null);

  useEffect(() => {
    let active = true;
    getBookingPayments(bookingId)
      .then((payments) => active && setLoaded({ bookingId, payments }))
      .catch(
        (err: Error) => active && setLoaded({ bookingId, error: err.message }),
      );
    return () => {
      active = false;
    };
  }, [bookingId, version]);

  return loaded?.bookingId === bookingId ? loaded : null;
}
