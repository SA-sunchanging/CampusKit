import { api } from './client.ts';

// Listing service calls through the gateway (role B). Types follow the service's
// Swagger page. Money is integer satang; times are ISO-8601 UTC.
export const CATEGORIES = [
  'BOOKS',
  'ELECTRONICS',
  'SPORTS',
  'CLOTHING',
  'MUSIC',
  'TOOLS',
  'OTHER',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CONDITIONS = ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR'] as const;
export type Condition = (typeof CONDITIONS)[number];

export const PICKUP_LOCATIONS = [
  'ENGINEERING',
  'ARTS',
  'SCIENCE',
  'CENTRAL_LIBRARY',
  'SPORTS_COMPLEX',
  'CHAMCHURI_SQUARE',
] as const;
export type PickupLocation = (typeof PICKUP_LOCATIONS)[number];

/**
 * DRAFT until Booking has set up the calendar. Then PUBLISHED and searchable, or
 * PENDING_REVIEW until an administrator approves (PUBLISHED) or rejects it
 * (REJECTED). The owner can take a PUBLISHED listing down (UNPUBLISHED).
 */
export type ListingStatus =
  'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'REJECTED' | 'UNPUBLISHED';

/** A half-open period [start, end); both ends are midnight in Bangkok. */
export interface DateRange {
  start: string;
  end: string;
}

/** A search result card. */
export interface ListingSummary {
  id: string;
  title: string;
  category: Category;
  condition: Condition;
  dailyRate: number;
  deposit: number;
  pickupLocations: PickupLocation[];
  ownerName: string;
  /** The owner's mean rating; null without reviews or while Review is unavailable. */
  ownerRating: number | null;
  ownerReviewCount: number;
  thumbnail: string | null;
  publishedAt: string;
}

export interface ListingPage {
  items: ListingSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Listing {
  id: string;
  ownerId: string;
  ownerName: string;
  /** Only from getListing: the owner's mean rating, null without reviews. */
  ownerRating?: number | null;
  /** Only from getListing. */
  ownerReviewCount?: number;
  status: ListingStatus;
  title: string;
  category: Category;
  description: string;
  condition: Condition;
  accessories: string[];
  replacementValue: number;
  dailyRate: number;
  deposit: number;
  lateFeePerDay: number;
  maxRentalDays: number;
  pickupLocations: PickupLocation[];
  blackouts: DateRange[];
  /** Data URLs; the first is the cover. */
  photos: string[];
  thumbnail: string | null;
  /** Why the last publish attempt failed. Set only on a DRAFT. */
  publishError: string | null;
  /** Why the listing was held for review; empty when it was not held. */
  moderationFlags: string[];
  /** The administrator's reason. Set only on a REJECTED listing. */
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
  /** When the listing was first published; kept after it is unpublished. */
  publishedAt: string | null;
  unpublishedAt: string | null;
}

/** A student's own listing, including statuses hidden from public search. */
export type OwnerListingSummary = Pick<
  Listing,
  | 'id'
  | 'title'
  | 'category'
  | 'status'
  | 'dailyRate'
  | 'thumbnail'
  | 'publishError'
  | 'rejectionReason'
  | 'createdAt'
>;

export interface OwnerListingPage {
  items: OwnerListingSummary[];
  total: number;
  page: number;
  pageSize: number;
}

/** A listing in the administrator's review queue. */
export interface ReviewItem {
  id: string;
  ownerId: string;
  ownerName: string;
  status: ListingStatus;
  title: string;
  category: Category;
  description: string;
  replacementValue: number;
  dailyRate: number;
  thumbnail: string | null;
  moderationFlags: string[];
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface ReviewQueue {
  items: ReviewItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateListingBody {
  title: string;
  category: Category;
  description: string;
  condition: Condition;
  accessories: string[];
  replacementValue: number;
  dailyRate: number;
  deposit: number;
  lateFeePerDay: number;
  maxRentalDays: number;
  pickupLocations: PickupLocation[];
  blackouts: DateRange[];
  photos: string[];
  thumbnail: string;
}

export interface SearchParams {
  q?: string;
  category?: Category;
  /** Only listings with this pickup point. */
  location?: PickupLocation;
  /** Only listings free for the whole period, at most 30 days long. */
  period?: DateRange;
  /** 1-based; page 1 is the default and is left out of the query. */
  page?: number;
  /** At most 50 on the server. */
  pageSize?: number;
}

/**
 * Builds "?q=...&category=...&location=...&start=...&end=...&page=...",
 * leaving out empty values and page 1.
 */
export function searchQuery(params: SearchParams): string {
  const query = new URLSearchParams();
  const q = params.q?.trim();
  if (q) query.set('q', q);
  if (params.category) query.set('category', params.category);
  if (params.location) query.set('location', params.location);
  if (params.period) {
    query.set('start', params.period.start);
    query.set('end', params.period.end);
  }
  if (params.page !== undefined && params.page > 1) {
    query.set('page', String(params.page));
  }
  if (params.pageSize !== undefined) {
    query.set('pageSize', String(params.pageSize));
  }
  const text = query.toString();
  return text ? `?${text}` : '';
}

/**
 * Published listings, newest first, each with its owner's rating. Public:
 * guests can search. With a period, only the first 200 matches are checked
 * for availability, and the service answers 503 while Booking is down.
 */
export function searchListings(params: SearchParams): Promise<ListingPage> {
  return api(`/listing/listings${searchQuery(params)}`);
}

/** All of the signed-in student's listings, newest first; the server determines ownership. */
export function getMyListings(
  page = 1,
  pageSize?: number,
): Promise<OwnerListingPage> {
  return api(`/listing/listings/mine${searchQuery({ page, pageSize })}`);
}

/**
 * A listing. Any status but PUBLISHED is shown only to its owner and
 * administrators; others get 404.
 */
export function getListing(id: string): Promise<Listing> {
  return api(`/listing/listings/${encodeURIComponent(id)}`);
}

/** Creates and publishes a listing; it stays a DRAFT with publishError when publishing fails. */
export function createListing(body: CreateListingBody): Promise<Listing> {
  return api('/listing/listings', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** Retries publishing a DRAFT; returns the listing as it is now. Owner only. */
export function publishListing(id: string): Promise<Listing> {
  return api(`/listing/listings/${encodeURIComponent(id)}/publish`, {
    method: 'POST',
  });
}

/**
 * Takes a PUBLISHED listing out of search and booking. Owner only; an
 * UNPUBLISHED listing is returned unchanged, any other status answers 409.
 */
export function unpublishListing(id: string): Promise<Listing> {
  return api(`/listing/listings/${encodeURIComponent(id)}/unpublish`, {
    method: 'POST',
  });
}

/** Builds "?status=...&page=..." for the review queue, leaving out page 1. */
export function reviewQueueQuery(status: ListingStatus, page = 1): string {
  const query = new URLSearchParams({ status });
  if (page > 1) query.set('page', String(page));
  return `?${query.toString()}`;
}

/** Listings in a status, oldest first (waiting for review by default). Admin only. */
export function getReviewQueue(
  status: ListingStatus = 'PENDING_REVIEW',
  page = 1,
): Promise<ReviewQueue> {
  return api(`/listing/admin/listings${reviewQueueQuery(status, page)}`);
}

/** Publishes a listing waiting for review. Admin only; 409 for any other status. */
export function approveListing(id: string): Promise<ReviewItem> {
  return api(`/listing/admin/listings/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
  });
}

/** Rejects a listing waiting for review; the owner sees the reason. Admin only. */
export function rejectListing(id: string, reason: string): Promise<ReviewItem> {
  return api(`/listing/admin/listings/${encodeURIComponent(id)}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}
