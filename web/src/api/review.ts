import { api } from './client.ts';

// Review calls through the gateway (role E). Types follow the gateway's Swagger page
// (tag "reviews"). Times are ISO-8601 UTC.

export const MAX_COMMENT_LENGTH = 500;
export const PAGE_SIZE = 20;

/** One participant's review of the other after a closed rental. */
export interface Review {
  id: string;
  rentalId: string;
  listingId: string;
  reviewerId: string;
  revieweeId: string;
  /** The reviewer's side of the rental. */
  reviewerRole: 'owner' | 'renter';
  /** Whole stars, 1 to 5. */
  rating: number;
  /** Empty when the reviewer wrote none. */
  comment: string;
  createdAt: string;
}

/** A page of the reviews one user received. */
export interface ReceivedReviews {
  /** Newest first. */
  items: Review[];
  /** All received reviews, not only this page. */
  total: number;
  /** Mean of all received ratings, one decimal; null without reviews. */
  averageRating: number | null;
  page: number;
  pageSize: number;
}

export interface NewReview {
  rentalId: string;
  rating: number;
  comment?: string;
}

/** Builds "?userId=...&page=...&pageSize=...". */
export function receivedQuery(userId: string, page: number): string {
  const params = new URLSearchParams({
    userId,
    page: String(page),
    pageSize: String(PAGE_SIZE),
  });
  return `?${params.toString()}`;
}

/** The submit body; a blank comment is left out. */
export function reviewBody(
  rentalId: string,
  rating: number,
  comment: string,
): NewReview {
  const text = comment.trim();
  return text ? { rentalId, rating, comment: text } : { rentalId, rating };
}

export function listReceived(
  userId: string,
  page = 1,
): Promise<ReceivedReviews> {
  return api(`/review/reviews${receivedQuery(userId, page)}`);
}

/** The caller's reviews of one rental: the one they wrote and the one they received. */
export async function rentalReviews(rentalId: string): Promise<Review[]> {
  const body = await api<{ items: Review[] }>(
    `/review/reviews/rentals/${encodeURIComponent(rentalId)}`,
  );
  return body.items;
}

/** Owner or renter of a closed rental, once each; anything else is refused. */
export function submitReview(review: NewReview): Promise<Review> {
  return api('/review/reviews', {
    method: 'POST',
    body: JSON.stringify(review),
  });
}
