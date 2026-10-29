import { useState } from 'react';
import {
  approveStudent,
  rejectStudent,
  type StudentReviewItem,
} from '../../api/identity.ts';
import { Alert, Button, Field, formatDate } from '../../ui/index.ts';

const MAX_REASON = 300;

// One student waiting for review, with Approve and Reject (role A). Admin only.
export default function StudentCard({
  item,
  onDone,
}: {
  item: StudentReviewItem;
  /** Called with a message once the student has left the queue. */
  onDone: (message: string) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  async function run(call: () => Promise<unknown>, message: string) {
    setPending(true);
    setError(null);
    try {
      await call();
      onDone(message);
    } catch (err) {
      setError((err as Error).message);
      setPending(false);
    }
  }

  const approve = () =>
    void run(() => approveStudent(item.id), `Verified ${item.displayName}.`);
  const reject = () =>
    void run(
      () => rejectStudent(item.id, reason.trim()),
      `Rejected ${item.displayName}.`,
    );

  return (
    <article className="panel admin-review">
      <div className="admin-review-head">
        <h3>{item.displayName}</h3>
      </div>
      <dl>
        <dt>Email</dt>
        <dd>{item.email}</dd>
        <dt>Student ID</dt>
        <dd>{item.studentId}</dd>
        <dt>Submitted</dt>
        <dd>{item.submittedAt ? formatDate(item.submittedAt) : '-'}</dd>
      </dl>
      {rejecting && (
        <Field label="Reason for the student" hint={`up to ${MAX_REASON}`}>
          <textarea
            value={reason}
            maxLength={MAX_REASON}
            required
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="actions">
        {rejecting ? (
          <>
            <Button disabled={pending || !reason.trim()} onClick={reject}>
              {pending ? 'Rejecting...' : 'Reject student'}
            </Button>
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() => setRejecting(false)}
            >
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button disabled={pending} onClick={approve}>
              {pending ? 'Approving...' : 'Approve'}
            </Button>
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() => setRejecting(true)}
            >
              Reject
            </Button>
          </>
        )}
      </div>
    </article>
  );
}
