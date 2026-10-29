import type { Review } from '../../api/review.ts';
import { formatDate } from '../../ui/index.ts';
import { stars } from './rating.ts';

// One review: the stars, the comment, and who wrote it when (role E).
export default function ReviewItem({ review }: { review: Review }) {
  return (
    <div className="review-item">
      <p className="review-stars" aria-label={`${review.rating} out of 5`}>
        {stars(review.rating)}
      </p>
      {review.comment && <p>{review.comment}</p>}
      <small>
        From the {review.reviewerRole} · {formatDate(review.createdAt)}
      </small>
    </div>
  );
}
