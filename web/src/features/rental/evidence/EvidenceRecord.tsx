import type { Evidence } from '../../../api/rental.ts';
import { CONDITION_LABELS } from '../../listing/options.ts';
import { recorderLabel } from './evidenceView.ts';

// What one party recorded at one stage (role D).
export default function EvidenceRecord({
  record,
  viewerId,
}: {
  record: Evidence;
  viewerId: string;
}) {
  const who = recorderLabel(record, viewerId);
  return (
    <div className="evidence-record">
      <p>
        <strong>{who}</strong> recorded the condition as{' '}
        <strong>{CONDITION_LABELS[record.condition]}</strong>.
      </p>
      <p>
        Accessories:{' '}
        {record.accessories.length > 0
          ? record.accessories.join(', ')
          : 'none listed'}
      </p>
      {record.note && <p>Note: {record.note}</p>}
      {record.photos.length > 0 && (
        <ul className="evidence-photos">
          {record.photos.map((photo, index) => (
            <li key={index}>
              <img src={photo} alt={`${who}: photo ${index + 1}`} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
