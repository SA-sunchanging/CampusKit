import type {
  Category,
  Condition,
  ListingStatus,
  PickupLocation,
} from '../../api/listing.ts';
import type { Tone } from '../../ui/index.ts';

// Display names for the listing codes. The service keeps the codes stable.
export const CATEGORY_LABELS: Record<Category, string> = {
  BOOKS: 'Books',
  ELECTRONICS: 'Electronics',
  SPORTS: 'Sports',
  CLOTHING: 'Clothing',
  MUSIC: 'Music',
  TOOLS: 'Tools',
  OTHER: 'Other',
};

export const CONDITION_LABELS: Record<Condition, string> = {
  NEW: 'New',
  LIKE_NEW: 'Like new',
  GOOD: 'Good',
  FAIR: 'Fair',
};

export const PICKUP_LABELS: Record<PickupLocation, string> = {
  ENGINEERING: 'Faculty of Engineering',
  ARTS: 'Faculty of Arts',
  SCIENCE: 'Faculty of Science',
  CENTRAL_LIBRARY: 'Central Library',
  SPORTS_COMPLEX: 'Sports Complex',
  CHAMCHURI_SQUARE: 'Chamchuri Square',
};

export const STATUS_LABELS: Record<ListingStatus, string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
};

export const STATUS_TONE: Record<ListingStatus, Tone> = {
  DRAFT: 'warning',
  PUBLISHED: 'success',
};
