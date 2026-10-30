import {
  CATEGORIES,
  type Category,
  type DateRange,
  PICKUP_LOCATIONS,
  type PickupLocation,
  type SearchParams,
} from '../../api/listing.ts';
import { bangkokDay, DAY_MS } from '../booking/dates.ts';
import { toBookingPeriod } from '../booking/bookingForm.ts';

// The search page keeps its filters in the URL (?q=&category=&location=&start=
// &end=&page=) so a search can be shared and the back button returns to the
// previous results.
export const PAGE_SIZE = 12;
/** Limits of the service's search query. */
export const MAX_KEYWORD_LENGTH = 100;
export const MAX_SEARCH_DAYS = 30;
const MAX_PAGE = 1000;

function isCategory(value: string | null): value is Category {
  return CATEGORIES.some((category) => category === value);
}

function isLocation(value: string | null): value is PickupLocation {
  return PICKUP_LOCATIONS.some((location) => location === value);
}

/** The period of whole Bangkok days in the URL, or undefined when it is missing or invalid. */
function readPeriod(params: URLSearchParams): DateRange | undefined {
  const start = Date.parse(params.get('start') ?? '');
  const end = Date.parse(params.get('end') ?? '');
  if (Number.isNaN(start) || Number.isNaN(end)) return undefined;
  return periodFromDays(bangkokDay(start), bangkokDay(end)).period;
}

/**
 * The search period from the pickup and return day inputs (YYYY-MM-DD): none
 * when both are empty, an error when only one is set or the days are out of
 * order or more than 30 days apart.
 */
export function periodFromDays(
  pickupDay: string,
  returnDay: string,
): { period?: DateRange; error?: string } {
  if (!pickupDay && !returnDay) return {};
  if (!pickupDay || !returnDay) {
    return { error: 'Choose both a pickup day and a return day.' };
  }
  const period = toBookingPeriod({ pickupDay, returnDay });
  if (!period) {
    return { error: 'The return day must be after the pickup day.' };
  }
  const days = (Date.parse(period.end) - Date.parse(period.start)) / DAY_MS;
  if (days > MAX_SEARCH_DAYS) {
    return { error: `Search at most ${MAX_SEARCH_DAYS} days at a time.` };
  }
  return { period };
}

/** The pickup and return days (YYYY-MM-DD) of a search period, for the inputs. */
export function periodDays(period: DateRange | undefined): {
  pickupDay: string;
  returnDay: string;
} {
  if (!period) return { pickupDay: '', returnDay: '' };
  return {
    pickupDay: bangkokDay(Date.parse(period.start)),
    returnDay: bangkokDay(Date.parse(period.end)),
  };
}

/** Reads the filters from the page URL, ignoring values the service would reject. */
export function readSearch(params: URLSearchParams): SearchParams {
  const q = params.get('q')?.trim().slice(0, MAX_KEYWORD_LENGTH).trim() ?? '';
  const category = params.get('category');
  const location = params.get('location');
  const period = readPeriod(params);
  const page = Number(params.get('page'));
  return {
    ...(q ? { q } : {}),
    ...(isCategory(category) ? { category } : {}),
    ...(isLocation(location) ? { location } : {}),
    ...(period ? { period } : {}),
    page: Number.isSafeInteger(page) && page > 1 ? Math.min(page, MAX_PAGE) : 1,
  };
}

/** Number of result pages; at least 1 so "Page 1 of 1" shows for no results. */
export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}
