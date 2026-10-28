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

/** DRAFT until Booking has set up the calendar, then PUBLISHED and searchable. */
export type ListingStatus = 'DRAFT' | 'PUBLISHED';

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
  createdAt: string;
  publishedAt: string | null;
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
  /** 1-based; page 1 is the default and is left out of the query. */
  page?: number;
  /** At most 50 on the server. */
  pageSize?: number;
}

/** Builds "?q=...&category=...&page=...", leaving out empty values and page 1. */
export function searchQuery(params: SearchParams): string {
  const query = new URLSearchParams();
  const q = params.q?.trim();
  if (q) query.set('q', q);
  if (params.category) query.set('category', params.category);
  if (params.page !== undefined && params.page > 1) {
    query.set('page', String(params.page));
  }
  if (params.pageSize !== undefined) {
    query.set('pageSize', String(params.pageSize));
  }
  const text = query.toString();
  return text ? `?${text}` : '';
}

/** Published listings, newest first. Public: guests can search. */
export function searchListings(params: SearchParams): Promise<ListingPage> {
  return api(`/listing/listings${searchQuery(params)}`);
}

/** A listing; the owner also gets their DRAFT. Others get 404 for a DRAFT. */
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
