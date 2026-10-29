import { useEffect, useState } from 'react';
import { getReviewQueue, type ReviewQueue } from '../../api/listing.ts';
import { Alert, Button, EmptyState, ShieldIcon } from '../../ui/index.ts';
import ReviewCard from './ReviewCard.tsx';

interface Loaded {
  /** The page this answer is for. */
  page: number;
  queue?: ReviewQueue;
  error?: string;
}

// Listings the moderation rule held back, oldest first (role B). Admin only.
export default function ListingReview() {
  const [page, setPage] = useState(1);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    getReviewQueue('PENDING_REVIEW', page)
      .then((queue) => active && setLoaded({ page, queue }))
      .catch((err: Error) => active && setLoaded({ page, error: err.message }));
    return () => {
      active = false;
    };
  }, [page, reload]);

  function handleDone(message: string) {
    setNotice(message);
    setReload((count) => count + 1);
  }

  const current = loaded?.page === page ? loaded : null;
  if (!current) return <p>Loading listings waiting for review...</p>;
  if (!current.queue) return <Alert tone="danger">{current.error}</Alert>;
  const { items, total, pageSize } = current.queue;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="stack">
      {notice && <Alert tone="success">{notice}</Alert>}
      {items.length === 0 ? (
        <EmptyState
          title="Nothing waiting for review"
          icon={<ShieldIcon size={32} />}
        >
          Listings worth 10,000 THB or more, or that mention restricted items,
          wait here before they are published.
        </EmptyState>
      ) : (
        <>
          <p className="admin-count">
            {total === 1 ? '1 listing' : `${total} listings`} waiting, oldest
            first.
          </p>
          {items.map((item) => (
            <ReviewCard key={item.id} item={item} onDone={handleDone} />
          ))}
        </>
      )}
      {pages > 1 && (
        <nav className="admin-pager" aria-label="Review pages">
          <Button
            variant="ghost"
            size="small"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <span>
            Page {page} of {pages}
          </span>
          <Button
            variant="ghost"
            size="small"
            disabled={page >= pages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </nav>
      )}
    </div>
  );
}
