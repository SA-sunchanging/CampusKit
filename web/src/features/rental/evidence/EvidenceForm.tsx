import { type FormEvent, useState } from 'react';
import { type Condition, CONDITIONS } from '../../../api/listing.ts';
import {
  type Evidence,
  type EvidenceStage,
  MAX_EVIDENCE_NOTE_LENGTH,
  recordEvidence,
} from '../../../api/rental.ts';
import { Alert, Button, Field } from '../../../ui/index.ts';
import { CONDITION_LABELS } from '../../listing/options.ts';
import EvidencePhotos from './EvidencePhotos.tsx';
import { accessoriesProblem, parseAccessories } from './evidenceView.ts';

// The viewer records the item's condition at pickup or at return (role D). Optional: the
// code step does not wait for it.
export default function EvidenceForm({
  rentalId,
  stage,
  onDone,
  onSkip,
}: {
  rentalId: string;
  stage: EvidenceStage;
  onDone: (record: Evidence) => void;
  onSkip: () => void;
}) {
  const [condition, setCondition] = useState<Condition>('GOOD');
  const [accessories, setAccessories] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending || busy) return;
    const list = parseAccessories(accessories);
    const problem = accessoriesProblem(list);
    if (problem) {
      setError(problem);
      return;
    }
    setPending(true);
    setError(null);
    try {
      onDone(
        await recordEvidence(rentalId, {
          stage,
          condition,
          accessories: list,
          photos,
          note,
        }),
      );
    } catch (err) {
      setError((err as Error).message);
      setPending(false);
    }
  }

  return (
    <form className="form" onSubmit={(event) => void submit(event)}>
      <Field label="Condition">
        <select
          value={condition}
          disabled={pending}
          onChange={(event) => setCondition(event.target.value as Condition)}
        >
          {CONDITIONS.map((code) => (
            <option key={code} value={code}>
              {CONDITION_LABELS[code]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Accessories" hint="one per line, optional">
        <textarea
          rows={3}
          value={accessories}
          disabled={pending}
          onChange={(event) => setAccessories(event.target.value)}
        />
      </Field>
      <EvidencePhotos
        photos={photos}
        onChange={setPhotos}
        busy={busy}
        onBusyChange={setBusy}
      />
      <Field label="Note" hint="optional">
        <textarea
          rows={2}
          maxLength={MAX_EVIDENCE_NOTE_LENGTH}
          value={note}
          disabled={pending}
          onChange={(event) => setNote(event.target.value)}
        />
      </Field>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="actions">
        <Button type="submit" disabled={pending || busy}>
          {pending ? 'Saving...' : 'Save evidence'}
        </Button>
        <Button variant="ghost" disabled={pending} onClick={onSkip}>
          Skip
        </Button>
      </div>
    </form>
  );
}
