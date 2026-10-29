import { useState } from 'react';
import {
  approveBooking,
  type Booking,
  declineBooking,
} from '../../api/booking.ts';
import { Alert, Button, Field } from '../../ui/index.ts';
import type { OwnerAction } from './status.ts';

const MAX_REASON = 500;

// Approve, decline, or retry approval on a booking card (role C). Owner only.
export default function OwnerActions({
  booking,
  action,
  onChange,
}: {
  booking: Booking;
  action: Exclude<OwnerAction, null>;
  onChange: (booking: Booking) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');

  async function run(call: () => Promise<Booking>) {
    setPending(true);
    setError(null);
    try {
      onChange(await call());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  const approve = () => void run(() => approveBooking(booking.id));
  const decline = () => void run(() => declineBooking(booking.id, reason));

  return (
    <div className="stack">
      {action === 'retry' && (
        <p className="booking-note">
          You approved this request, but payment authorization is not finished.
          Retry approval to try again.
        </p>
      )}
      {declining && (
        <Field label="Reason for the renter" hint="optional">
          <textarea
            value={reason}
            maxLength={MAX_REASON}
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="actions">
        {action === 'retry' && (
          <Button disabled={pending} onClick={approve}>
            {pending ? 'Retrying...' : 'Retry approval'}
          </Button>
        )}
        {action === 'decide' && (
          <DecideButtons
            declining={declining}
            pending={pending}
            onApprove={approve}
            onDecline={decline}
            onDeclining={setDeclining}
          />
        )}
      </div>
    </div>
  );
}

function DecideButtons({
  declining,
  pending,
  onApprove,
  onDecline,
  onDeclining,
}: {
  declining: boolean;
  pending: boolean;
  onApprove: () => void;
  onDecline: () => void;
  onDeclining: (declining: boolean) => void;
}) {
  if (declining) {
    return (
      <>
        <Button disabled={pending} onClick={onDecline}>
          {pending ? 'Declining...' : 'Decline request'}
        </Button>
        <Button
          variant="ghost"
          disabled={pending}
          onClick={() => onDeclining(false)}
        >
          Keep request
        </Button>
      </>
    );
  }
  return (
    <>
      <Button disabled={pending} onClick={onApprove}>
        {pending ? 'Approving...' : 'Approve'}
      </Button>
      <Button
        variant="ghost"
        disabled={pending}
        onClick={() => onDeclining(true)}
      >
        Decline
      </Button>
    </>
  );
}
