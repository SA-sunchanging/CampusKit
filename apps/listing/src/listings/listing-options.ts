/** Fixed choices for a listing. The database checks the same values (see the migrations). */
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

/** Campus pickup points. Codes stay stable; the web app shows the names. */
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
export const LISTING_STATUSES = ['DRAFT', 'PUBLISHED'] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

/** Money is integer satang (1 THB = 100 satang). */
export const MAX_DAILY_RATE = 10_000_000;
export const MAX_AMOUNT = 100_000_000;
export const MAX_RENTAL_DAYS = 30;
export const MAX_PHOTOS = 5;
