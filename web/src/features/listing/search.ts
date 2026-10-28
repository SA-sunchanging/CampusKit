import {
  CATEGORIES,
  type Category,
  type SearchParams,
} from '../../api/listing.ts';

// The search page keeps its filters in the URL (?q=&category=&page=) so a search
// can be shared and the back button returns to the previous results.
export const PAGE_SIZE = 12;
/** Limits of the service's search query. */
export const MAX_KEYWORD_LENGTH = 100;
const MAX_PAGE = 1000;

function isCategory(value: string | null): value is Category {
  return CATEGORIES.some((category) => category === value);
}

/** Reads the filters from the page URL, ignoring values the service would reject. */
export function readSearch(params: URLSearchParams): SearchParams {
  const q = params.get('q')?.trim().slice(0, MAX_KEYWORD_LENGTH).trim() ?? '';
  const category = params.get('category');
  const page = Number(params.get('page'));
  return {
    ...(q ? { q } : {}),
    ...(isCategory(category) ? { category } : {}),
    page: Number.isSafeInteger(page) && page > 1 ? Math.min(page, MAX_PAGE) : 1,
  };
}

/** Number of result pages; at least 1 so "Page 1 of 1" shows for no results. */
export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}
