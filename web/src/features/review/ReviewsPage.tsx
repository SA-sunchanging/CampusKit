import { useEffect, useState } from 'react';
import { listReceived, type ReceivedReviews } from '../../api/review.ts';
import { useAuth } from '../../auth/useAuth.ts';
import {
  Alert,
  Button,
  EmptyState,
  PageHeader,
  Panel,
  StarIcon,
} from '../../ui/index.ts';
import { reputationText } from './rating.ts';
import ReviewItem from './ReviewItem.tsx';
import './review.css';

interface Loaded {
  /** The page this answer is for. */
  page: number;
  reviews?: ReceivedReviews;
  error?: string;
}

// The reviews the student received from the people they rented with (role E), newest first.
export default function ReviewsPage() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const [page, setPage] = useState(1);
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    listReceived(userId, page)
      .then((reviews) => active && setLoaded({ page, reviews }))
      .catch((err: Error) => active && setLoaded({ page, error: err.message }));
    return () => {
      active = false;
    };
  }, [userId, page]);

  const current = loaded?.page === page ? loaded : null;
  const reviews = current?.reviews;
  return (
    <section>
      <PageHeader title="Reviews" />
      {!current && <p>Loading reviews...</p>}
      {current?.error && <Alert tone="danger">{current.error}</Alert>}
      {reviews && (
        <Panel title="Reviews of you">
          {reviews.total === 0 ? (
            <EmptyState title="No reviews yet" icon={<StarIcon size={32} />}>
              After a rental closes, the other person can review you.
            </EmptyState>
          ) : (
            <div className="review-list">
              <p>{reputationText(reviews.averageRating, reviews.total)}</p>
              {reviews.items.map((review) => (
                <ReviewItem key={review.id} review={review} />
              ))}
            </div>
          )}
          <Pager reviews={reviews} onPage={setPage} />
        </Panel>
      )}
    </section>
  );
}

function Pager({
  reviews,
  onPage,
}: {
  reviews: ReceivedReviews;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(reviews.total / reviews.pageSize));
  if (pages === 1 && reviews.page === 1) return null;
  return (
    <div className="actions">
      <Button
        variant="ghost"
        size="small"
        disabled={reviews.page <= 1}
        onClick={() => onPage(Math.min(reviews.page - 1, pages))}
      >
        Previous
      </Button>
      <span>
        Page {reviews.page} of {pages}
      </span>
      <Button
        variant="ghost"
        size="small"
        disabled={reviews.page >= pages}
        onClick={() => onPage(reviews.page + 1)}
      >
        Next
      </Button>
    </div>
  );
}
