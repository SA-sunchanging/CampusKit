import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { getListing, publishListing, type Listing } from '../../api/listing.ts';
import { useAuth } from '../../auth/useAuth.ts';
import BookingRequestPanel from '../booking/BookingRequestPanel.tsx';
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  PageHeader,
  Panel,
} from '../../ui/index.ts';
import Gallery from './Gallery.tsx';
import { ItemDetails, PriceBox } from './ListingFacts.tsx';
import {
  CATEGORY_LABELS,
  CONDITION_LABELS,
  STATUS_LABELS,
  STATUS_TONE,
} from './options.ts';
import './listing.css';

// The service rejects ids that are not UUIDs, so such a link is simply not found.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Loaded {
  /** The listing id and viewer this answer is for. */
  key: string;
  listing?: Listing;
  error?: string;
}

// One listing (role B). Public; the owner also sees their DRAFT.
export default function ListingDetailPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const viewerId = user?.id ?? '';
  const key = `${id}|${viewerId}`;
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  // Load again when the viewer changes: only the owner may see a DRAFT.
  useEffect(() => {
    if (!UUID.test(id)) return;
    let active = true;
    const answer = `${id}|${viewerId}`;
    getListing(id)
      .then((listing) => active && setLoaded({ key: answer, listing }))
      .catch(
        (err: Error) =>
          active && setLoaded({ key: answer, error: err.message }),
      );
    return () => {
      active = false;
    };
  }, [id, viewerId]);

  const current = loaded?.key === key ? loaded : null;
  // The API client keeps only the message, so a 404 is recognised by its text.
  const notFound =
    !UUID.test(id) || (current?.error && /not found/i.test(current.error));

  if (notFound) {
    return (
      <EmptyState title="Listing not found">
        It may have been removed or not published yet.{' '}
        <Link to="/">Back to listings</Link>
      </EmptyState>
    );
  }
  if (!current) return <p>Loading listing...</p>;
  if (!current.listing) {
    return (
      <section className="stack">
        <Alert tone="danger">{current.error}</Alert>
        <p>
          <Link to="/">Back to listings</Link>
        </p>
      </section>
    );
  }
  return (
    <ListingView
      listing={current.listing}
      isOwner={current.listing.ownerId === viewerId}
      onChange={(listing) => setLoaded({ key, listing })}
    />
  );
}

function ListingView({
  listing,
  isOwner,
  onChange,
}: {
  listing: Listing;
  isOwner: boolean;
  onChange: (listing: Listing) => void;
}) {
  const [published, setPublished] = useState(false);

  function handleChange(next: Listing) {
    setPublished(next.status === 'PUBLISHED');
    onChange(next);
  }

  return (
    <section>
      <p>
        <Link to="/">Back to listings</Link>
      </p>
      <PageHeader
        title={listing.title}
        aside={`Listed by ${listing.ownerName}`}
      />
      <div className="listing-badges">
        <Badge>{CATEGORY_LABELS[listing.category]}</Badge>
        <Badge>{CONDITION_LABELS[listing.condition]}</Badge>
        <Badge tone={STATUS_TONE[listing.status]}>
          {STATUS_LABELS[listing.status]}
        </Badge>
      </div>
      {isOwner && listing.status === 'DRAFT' && (
        <DraftNotice listing={listing} onChange={handleChange} />
      )}
      {published && (
        <Alert tone="success">
          Your listing is published and now shows in search.
        </Alert>
      )}
      <div className="split">
        <Gallery
          key={listing.id}
          photos={listing.photos}
          title={listing.title}
        />
        <div>
          <PriceBox listing={listing} />
          {/* Booking request form (role C). */}
          {!isOwner && <BookingRequestPanel listing={listing} />}
        </div>
      </div>
      <ItemDetails listing={listing} />
    </section>
  );
}

// Shown to the owner while Booking has not set up the calendar yet.
function DraftNotice({
  listing,
  onChange,
}: {
  listing: Listing;
  onChange: (listing: Listing) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePublish() {
    setPending(true);
    setError(null);
    try {
      onChange(await publishListing(listing.id));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Panel title="Not published yet">
      <div className="stack">
        <Alert tone="danger">
          This listing is a draft, so it does not show in search.{' '}
          {listing.publishError ?? 'Publishing has not finished.'}
        </Alert>
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="actions">
          <Button disabled={pending} onClick={() => void handlePublish()}>
            {pending ? 'Publishing...' : 'Publish again'}
          </Button>
        </div>
      </div>
    </Panel>
  );
}
