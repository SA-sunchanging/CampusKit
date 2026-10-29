import { type FormEvent, useState } from 'react';
import { confirmPickup, confirmReturn, type Rental } from '../../api/rental.ts';
import { Alert, Button, Field, Panel } from '../../ui/index.ts';
import { CODE_LENGTH, cleanCode, isCompleteCode } from './codeInput.ts';

const TEXT = {
  pickup: {
    title: 'Confirm pickup',
    label: "The owner's pickup code",
    use: 'When you receive the item, ask the owner for their pickup code and enter it here. The rental fee is charged at pickup.',
    submit: 'Confirm pickup',
    pending: 'Confirming...',
  },
  return: {
    title: 'Confirm return',
    label: "The renter's return code",
    use: 'When you get the item back, ask the renter for their return code and enter it here. The deposit is settled after the return.',
    submit: 'Confirm return',
    pending: 'Confirming...',
  },
};

// The renter enters the pickup code, or the owner enters the return code (role D).
export default function CodeEntryForm({
  kind,
  rentalId,
  onDone,
}: {
  kind: 'pickup' | 'return';
  rentalId: string;
  onDone: (rental: Rental) => void;
}) {
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const text = TEXT[kind];

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!isCompleteCode(code) || pending) return;
    setPending(true);
    setError(null);
    try {
      const call = kind === 'pickup' ? confirmPickup : confirmReturn;
      onDone(await call(rentalId, code));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Panel title={text.title}>
      <form className="form" onSubmit={(event) => void submit(event)}>
        <p>{text.use}</p>
        <Field label={text.label} hint={`${CODE_LENGTH} digits`}>
          <input
            className="rental-code-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={CODE_LENGTH}
            value={code}
            disabled={pending}
            onChange={(event) => setCode(cleanCode(event.target.value))}
          />
        </Field>
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="actions">
          <Button type="submit" disabled={pending || !isCompleteCode(code)}>
            {pending ? text.pending : text.submit}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
