import { useState } from 'react';
import { confirmReturn, type Rental } from '../../api/rental.ts';
import { Alert, Button, Panel } from '../../ui/index.ts';

// The owner retries a settlement that did not finish (role D). Rental keeps the return time
// and late fee, and Payment's operation IDs stay the same, so nothing is charged twice.
export default function RetrySettlement({
  rental,
  onDone,
}: {
  rental: Rental;
  onDone: (rental: Rental) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function retry() {
    setPending(true);
    setError(null);
    try {
      onDone(await confirmReturn(rental.id));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Panel title="Settlement">
      <div className="stack">
        <p>
          You accepted the return, but releasing the dates or settling the
          deposit did not finish. Retry to finish it; nothing is charged twice.
        </p>
        {rental.lastError && (
          <Alert tone="danger">Last attempt: {rental.lastError}</Alert>
        )}
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="actions">
          <Button disabled={pending} onClick={() => void retry()}>
            {pending ? 'Retrying...' : 'Retry settlement'}
          </Button>
        </div>
      </div>
    </Panel>
  );
}
