import { type FormEvent, useEffect, useState } from 'react';
import type { Rental } from '../../api/rental.ts';
import {
  MAX_COMMENT_LENGTH,
  rentalReviews,
  type Review,
  reviewBody,
  submitReview,
} from '../../api/review.ts';
import { Alert, Button, Field, Panel } from '../../ui/index.ts';
import { RATINGS, ratingOption } from './rating.ts';
import ReviewItem from './ReviewItem.tsx';
import './review.css';

interface Loaded {
  reviews?: Review[];
  error?: string;
}

// On a closed rental, the renter and the owner review each other once (role E).
export default function ReviewPanel({
  rental,
  viewerId,
}: {
  rental: Rental;
  viewerId: string;
}) {
  const closed = rental.status === 'CLOSED';
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (!closed) return;
    let active = true;
    rentalReviews(rental.id)
      .then((reviews) => active && setLoaded({ reviews }))
      .catch((err: Error) => active && setLoaded({ error: err.message }));
    return () => {
      active = false;
    };
  }, [closed, rental.id]);

  if (!closed) return null;
  const reviews = loaded?.reviews;
  // Review stores user IDs in lower case.
  const me = viewerId.toLowerCase();
  const mine = reviews?.find((review) => review.reviewerId === me);
  const theirs = reviews?.find((review) => review.revieweeId === me);
  return (
    <Panel title="Review">
      {!loaded && <p>Loading reviews...</p>}
      {loaded?.error && <Alert tone="danger">{loaded.error}</Alert>}
      {reviews && (
        <div className="review-list">
          {mine ? (
            <div className="stack">
              <p>You reviewed this rental.</p>
              <ReviewItem review={mine} />
            </div>
          ) : (
            <ReviewForm
              rentalId={rental.id}
              onDone={(review) => setLoaded({ reviews: [...reviews, review] })}
            />
          )}
          {theirs && (
            <div className="stack">
              <p>Their review of you:</p>
              <ReviewItem review={theirs} />
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

function ReviewForm({
  rentalId,
  onDone,
}: {
  rentalId: string;
  onDone: (review: Review) => void;
}) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      onDone(await submitReview(reviewBody(rentalId, rating, comment)));
    } catch (err) {
      setError((err as Error).message);
      setPending(false);
    }
  }

  return (
    <form className="form" onSubmit={(event) => void submit(event)}>
      <p>How did this rental go? The other person sees your review.</p>
      <Field label="Rating">
        <select
          value={rating}
          disabled={pending}
          onChange={(event) => setRating(Number(event.target.value))}
        >
          {RATINGS.map((value) => (
            <option key={value} value={value}>
              {ratingOption(value)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Comment" hint="optional">
        <textarea
          rows={3}
          maxLength={MAX_COMMENT_LENGTH}
          value={comment}
          disabled={pending}
          onChange={(event) => setComment(event.target.value)}
        />
      </Field>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="actions">
        <Button type="submit" disabled={pending}>
          {pending ? 'Sending...' : 'Send review'}
        </Button>
      </div>
    </form>
  );
}
