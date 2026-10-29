import { useState } from 'react';
import { Link } from 'react-router';
import {
  approveListing,
  rejectListing,
  type ReviewItem,
} from '../../api/listing.ts';
import {
  Alert,
  Badge,
  Button,
  Field,
  formatBaht,
  formatDate,
} from '../../ui/index.ts';
import { CATEGORY_LABELS } from '../listing/options.ts';

const MAX_REASON = 300;

// One listing waiting for review, with Approve and Reject (role B). Admin only.
export default function ReviewCard({
  item,
  onDone,
}: {
  item: ReviewItem;
  /** Called with a message once the listing has left the queue. */
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
    void run(() => approveListing(item.id), `Published "${item.title}".`);
  const reject = () =>
    void run(
      () => rejectListing(item.id, reason.trim()),
      `Rejected "${item.title}".`,
    );

  return (
    <article className="panel admin-review">
      <div className="admin-review-head">
        <h3>
          <Link to={`/listings/${item.id}`}>{item.title}</Link>
        </h3>
        <Badge>{CATEGORY_LABELS[item.category]}</Badge>
      </div>
      <dl>
        <dt>Owner</dt>
        <dd>{item.ownerName}</dd>
        <dt>Replacement value</dt>
        <dd>{formatBaht(item.replacementValue)}</dd>
        <dt>Daily rate</dt>
        <dd>{formatBaht(item.dailyRate)}</dd>
        <dt>Submitted</dt>
        <dd>{formatDate(item.createdAt)}</dd>
      </dl>
      <div className="admin-flags">
        {item.moderationFlags.map((flag) => (
          <Badge key={flag} tone="warning">
            {flag}
          </Badge>
        ))}
      </div>
      <p className="admin-description">{item.description}</p>
      {rejecting && (
        <Field label="Reason for the owner" hint={`up to ${MAX_REASON}`}>
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
              {pending ? 'Rejecting...' : 'Reject listing'}
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
