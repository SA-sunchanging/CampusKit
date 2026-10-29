import { useState } from 'react';
import {
  type Listing,
  publishListing,
  unpublishListing,
} from '../../api/listing.ts';
import { Alert, Button, formatDate, Panel } from '../../ui/index.ts';

type OnChange = (listing: Listing) => void;

// What the owner of a listing sees about its status, with the action that fits
// it (role B): retry a DRAFT, read why it waits or was rejected, or unpublish.
export default function OwnerStatus({
  listing,
  onChange,
}: {
  listing: Listing;
  onChange: OnChange;
}) {
  switch (listing.status) {
    case 'DRAFT':
      return <DraftNotice listing={listing} onChange={onChange} />;
    case 'PENDING_REVIEW':
      return (
        <Panel title="Waiting for review">
          <div className="stack">
            <p>
              An administrator checks this listing before it shows in search.
              You get a notice in your inbox when they decide.
            </p>
            <FlagList flags={listing.moderationFlags} />
          </div>
        </Panel>
      );
    case 'REJECTED':
      return (
        <Panel title="Not approved">
          <Alert tone="danger">
            An administrator rejected this listing, so it does not show in
            search. Reason: {listing.rejectionReason}
          </Alert>
        </Panel>
      );
    case 'UNPUBLISHED':
      return (
        <Panel title="Unpublished">
          <p>
            You unpublished this listing
            {listing.unpublishedAt &&
              ` on ${formatDate(listing.unpublishedAt)}`}
            . It does not show in search and cannot be booked. Bookings already
            confirmed go ahead as agreed.
          </p>
        </Panel>
      );
    case 'PUBLISHED':
      return <UnpublishPanel listing={listing} onChange={onChange} />;
  }
}

function FlagList({ flags }: { flags: string[] }) {
  if (flags.length === 0) return null;
  return (
    <ul className="listing-flags">
      {flags.map((flag) => (
        <li key={flag}>{flag}</li>
      ))}
    </ul>
  );
}

// Runs one owner action at a time and keeps its error.
function useAction(onChange: OnChange) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(call: () => Promise<Listing>) {
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

  return { pending, error, run };
}

// Shown to the owner while Booking has not set up the calendar yet.
function DraftNotice({
  listing,
  onChange,
}: {
  listing: Listing;
  onChange: OnChange;
}) {
  const { pending, error, run } = useAction(onChange);
  return (
    <Panel title="Not published yet">
      <div className="stack">
        <Alert tone="danger">
          This listing is a draft, so it does not show in search.{' '}
          {listing.publishError ?? 'Publishing has not finished.'}
        </Alert>
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="actions">
          <Button
            disabled={pending}
            onClick={() => void run(() => publishListing(listing.id))}
          >
            {pending ? 'Publishing...' : 'Publish again'}
          </Button>
        </div>
      </div>
    </Panel>
  );
}

// Lets the owner take a PUBLISHED listing out of search, after a confirmation.
function UnpublishPanel({
  listing,
  onChange,
}: {
  listing: Listing;
  onChange: OnChange;
}) {
  const { pending, error, run } = useAction(onChange);
  const [confirming, setConfirming] = useState(false);
  return (
    <Panel title="Your listing">
      <div className="stack">
        <p>
          {confirming
            ? 'Unpublish this listing? It leaves search and no one can send a new booking request. Bookings already confirmed go ahead as agreed.'
            : 'This listing shows in search and students can request it.'}
        </p>
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="actions">
          {confirming ? (
            <>
              <Button
                disabled={pending}
                onClick={() => void run(() => unpublishListing(listing.id))}
              >
                {pending ? 'Unpublishing...' : 'Unpublish listing'}
              </Button>
              <Button
                variant="ghost"
                disabled={pending}
                onClick={() => setConfirming(false)}
              >
                Keep published
              </Button>
            </>
          ) : (
            <Button variant="ghost" onClick={() => setConfirming(true)}>
              Unpublish
            </Button>
          )}
        </div>
      </div>
    </Panel>
  );
}
