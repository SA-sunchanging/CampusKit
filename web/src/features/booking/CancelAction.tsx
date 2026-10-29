import { useState } from 'react';
import { type Booking, cancelBooking } from '../../api/booking.ts';
import { Alert, Button, Field } from '../../ui/index.ts';

const MAX_REASON = 200;

// Cancel a booking before pickup (role C), for the renter or the owner. A first click asks
// for confirmation and an optional reason; nothing is charged.
export default function CancelAction({
  booking,
  onChange,
}: {
  booking: Booking;
  onChange: (booking: Booking) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setPending(true);
    setError(null);
    try {
      onChange(await cancelBooking(booking.id, reason));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  if (!confirming) {
    return (
      <div className="actions">
        <Button variant="ghost" onClick={() => setConfirming(true)}>
          Cancel booking
        </Button>
      </div>
    );
  }
  return (
    <div className="stack">
      <p className="booking-note">
        Cancel this booking? The dates are freed and nothing is charged.
      </p>
      <Field label="Reason for the other person" hint="optional">
        <textarea
          value={reason}
          maxLength={MAX_REASON}
          onChange={(event) => setReason(event.target.value)}
        />
      </Field>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="actions">
        <Button disabled={pending} onClick={() => void cancel()}>
          {pending ? 'Cancelling...' : 'Cancel booking'}
        </Button>
        <Button
          variant="ghost"
          disabled={pending}
          onClick={() => setConfirming(false)}
        >
          Keep booking
        </Button>
      </div>
    </div>
  );
}
