import { useEffect, useState } from 'react';
import {
  type Evidence,
  type EvidenceStage,
  listEvidence,
  type Rental,
} from '../../../api/rental.ts';
import { Alert, Button, Panel } from '../../../ui/index.ts';
import EvidenceForm from './EvidenceForm.tsx';
import EvidenceRecord from './EvidenceRecord.tsx';
import {
  canRecord,
  showStage,
  STAGE_TITLES,
  STAGES,
  stageRecords,
} from './evidenceView.ts';
import './evidence.css';

interface Loaded {
  records?: Evidence[];
  error?: string;
}

// Condition evidence at pickup and at return (role D): what each party recorded, and a form
// for the viewer while the stage is open. Placed before the code step; recording is optional.
export default function EvidenceSection({
  rental,
  viewerId,
}: {
  rental: Rental;
  viewerId: string;
}) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [skipped, setSkipped] = useState<EvidenceStage[]>([]);

  // Read again when the status moves on: the other party may have recorded meanwhile.
  useEffect(() => {
    let active = true;
    listEvidence(rental.id)
      .then((records) => active && setLoaded({ records }))
      .catch((err: Error) => active && setLoaded({ error: err.message }));
    return () => {
      active = false;
    };
  }, [rental.id, rental.status]);

  const records = loaded?.records;
  const stages = records
    ? STAGES.filter((stage) => showStage(stage, rental.status, records))
    : [];
  if (records && stages.length === 0) return null;
  return (
    <Panel title="Condition evidence">
      {!loaded && <p>Loading evidence...</p>}
      {loaded?.error && <Alert tone="danger">{loaded.error}</Alert>}
      {records &&
        stages.map((stage) => (
          <div key={stage} className="evidence-stage">
            <h3>{STAGE_TITLES[stage]}</h3>
            {stageRecords(records, stage, viewerId).map((record) => (
              <EvidenceRecord
                key={record.id}
                record={record}
                viewerId={viewerId}
              />
            ))}
            {canRecord(stage, rental.status, records, viewerId) &&
              (skipped.includes(stage) ? (
                <p>
                  You skipped recording the condition.{' '}
                  <Button
                    variant="ghost"
                    size="small"
                    onClick={() =>
                      setSkipped((list) => list.filter((s) => s !== stage))
                    }
                  >
                    Record it
                  </Button>
                </p>
              ) : (
                <>
                  <p className="rental-note">
                    Optional. Record the item&apos;s condition, accessories, and
                    photos before you enter the code. Both of you can see it;
                    nothing is deducted automatically.
                  </p>
                  <EvidenceForm
                    rentalId={rental.id}
                    stage={stage}
                    onDone={(record) =>
                      setLoaded({ records: [...records, record] })
                    }
                    onSkip={() => setSkipped((list) => [...list, stage])}
                  />
                </>
              ))}
          </div>
        ))}
    </Panel>
  );
}
