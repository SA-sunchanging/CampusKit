import type {
  Category,
  Condition,
  CreateListingBody,
  DateRange,
  PickupLocation,
} from '../../api/listing.ts';
import { dataUrlBytes, MAX_PHOTOS, PHOTO_MAX_BYTES } from './photos.ts';

// State, checks, and conversion for the create form. The limits mirror the
// listing service for quick feedback; the server stays authoritative.
const DAY_MS = 24 * 60 * 60 * 1000;
/** Asia/Bangkok is UTC+7 all year (no daylight saving). */
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
/** The service accepts unavailable periods that end within this window. */
const HORIZON_MS = 366 * DAY_MS;

export const MAX_ACCESSORIES = 10;
export const MAX_ACCESSORY_LENGTH = 60;
export const MAX_PICKUP_LOCATIONS = 3;
export const MAX_BLACKOUTS = 10;
export const MAX_RENTAL_DAYS = 30;
const MAX_DAILY_RATE = 10_000_000;
const MAX_AMOUNT = 100_000_000;

/** One unavailable period as typed: both days inclusive, as YYYY-MM-DD. */
export interface BlackoutRow {
  key: number;
  firstDay: string;
  lastDay: string;
}

/** A compressed photo and the thumbnail made from it, both data URLs. */
export interface PhotoItem {
  key: number;
  dataUrl: string;
  thumbnail: string;
}

/** Money fields hold the text the owner typed, in baht. */
export interface ListingFormState {
  title: string;
  category: Category | '';
  description: string;
  condition: Condition | '';
  accessories: string;
  dailyRate: string;
  deposit: string;
  lateFeePerDay: string;
  replacementValue: string;
  maxRentalDays: string;
  pickupLocations: PickupLocation[];
  blackouts: BlackoutRow[];
  photos: PhotoItem[];
}

export type FormErrors = Partial<Record<keyof ListingFormState, string>>;

export const EMPTY_FORM: ListingFormState = {
  title: '',
  category: '',
  description: '',
  condition: '',
  accessories: '',
  dailyRate: '',
  deposit: '',
  lateFeePerDay: '',
  replacementValue: '',
  maxRentalDays: '7',
  pickupLocations: [],
  blackouts: [],
  photos: [],
};

const BAHT = /^(\d+|\d{1,3}(,\d{3})+)(\.\d{1,2})?$/;

/** "1,250.5" -> 125050 satang. Null for blanks, negatives, junk, or more than 2 decimals. */
export function bahtToSatang(text: string): number | null {
  const trimmed = text.trim();
  if (!BAHT.test(trimmed)) return null;
  const [whole, fraction = ''] = trimmed.replace(/,/g, '').split('.');
  const satang = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(satang) ? satang : null;
}

/** Splits the accessories box on commas and new lines, dropping blanks. */
export function parseAccessories(text: string): string[] {
  return text
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

/** Midnight at the start of a Bangkok calendar day, in ms; null for an invalid date. */
function bangkokMidnight(day: string, addDays = 0): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return null;
  const [year, month, date] = match.slice(1).map(Number);
  const utc = Date.UTC(year, month - 1, date);
  const check = new Date(utc);
  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== date) {
    return null;
  }
  return Date.UTC(year, month - 1, date + addDays) - BANGKOK_OFFSET_MS;
}

/**
 * Turns inclusive days from date inputs into the half-open range the service
 * stores: from 00:00 Bangkok on the first day to 00:00 Bangkok after the last.
 * Null when a day is invalid or the last day is before the first.
 */
export function dateInputToBangkokRange(
  firstDay: string,
  lastDay: string,
): DateRange | null {
  const start = bangkokMidnight(firstDay);
  const end = bangkokMidnight(lastDay, 1);
  if (start === null || end === null || end <= start) return null;
  return {
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
  };
}

/** Today's date in Bangkok as YYYY-MM-DD, for the date inputs' min. */
export function bangkokToday(now: Date): string {
  return new Date(now.getTime() + BANGKOK_OFFSET_MS).toISOString().slice(0, 10);
}

function lengthError(
  label: string,
  text: string,
  min: number,
  max: number,
): string | undefined {
  const length = text.trim().length;
  if (length >= min && length <= max) return undefined;
  return `${label} must be ${min} to ${max} characters.`;
}

function amountError(text: string, min: number, max: number) {
  const satang = bahtToSatang(text);
  if (satang === null) {
    return 'Enter an amount in baht, for example 150 or 150.50.';
  }
  if (satang < min) return `Enter at least ${min / 100} baht.`;
  if (satang > max)
    return `Enter at most ${(max / 100).toLocaleString('en')} baht.`;
  return undefined;
}

function accessoriesError(text: string): string | undefined {
  const items = parseAccessories(text);
  if (items.length > MAX_ACCESSORIES) {
    return `List at most ${MAX_ACCESSORIES} accessories.`;
  }
  if (items.some((item) => item.length > MAX_ACCESSORY_LENGTH)) {
    return `Each accessory must be at most ${MAX_ACCESSORY_LENGTH} characters.`;
  }
  return undefined;
}

function rentalDaysError(text: string): string | undefined {
  const days = /^\d+$/.test(text.trim()) ? Number(text) : NaN;
  if (days >= 1 && days <= MAX_RENTAL_DAYS) return undefined;
  return `Enter a whole number of days from 1 to ${MAX_RENTAL_DAYS}.`;
}

function blackoutsError(rows: BlackoutRow[], now: Date): string | undefined {
  if (rows.length > MAX_BLACKOUTS) {
    return `Add at most ${MAX_BLACKOUTS} unavailable periods.`;
  }
  const ranges: DateRange[] = [];
  for (const [index, row] of rows.entries()) {
    const name = `Unavailable period ${index + 1}`;
    if (!row.firstDay || !row.lastDay) return `${name}: pick both days.`;
    const range = dateInputToBangkokRange(row.firstDay, row.lastDay);
    if (!range) return `${name}: the last day must not be before the first.`;
    if (Date.parse(range.end) > now.getTime() + HORIZON_MS) {
      return `${name}: must end within one year.`;
    }
    ranges.push(range);
  }
  ranges.sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const overlaps = ranges.some(
    (range, index) => index > 0 && range.start < ranges[index - 1].end,
  );
  return overlaps ? 'Unavailable periods must not overlap.' : undefined;
}

function photosError(photos: PhotoItem[]): string | undefined {
  if (photos.length < 1) return 'Add at least one photo.';
  if (photos.length > MAX_PHOTOS) return `Add at most ${MAX_PHOTOS} photos.`;
  if (photos.some((photo) => dataUrlBytes(photo.dataUrl) > PHOTO_MAX_BYTES)) {
    return 'A photo is still too large; remove it and add it again.';
  }
  return undefined;
}

function pickupError(locations: PickupLocation[]): string | undefined {
  if (locations.length >= 1 && locations.length <= MAX_PICKUP_LOCATIONS) {
    return undefined;
  }
  return `Choose 1 to ${MAX_PICKUP_LOCATIONS} pickup locations.`;
}

/** Returns a message per invalid field; an empty object means the form can be sent. */
export function validateListingForm(
  state: ListingFormState,
  now = new Date(),
): FormErrors {
  const errors: FormErrors = {
    title: lengthError('The title', state.title, 3, 100),
    category: state.category ? undefined : 'Choose a category.',
    description: lengthError('The description', state.description, 10, 2000),
    condition: state.condition ? undefined : 'Choose a condition.',
    accessories: accessoriesError(state.accessories),
    dailyRate: amountError(state.dailyRate, 1, MAX_DAILY_RATE),
    deposit: amountError(state.deposit, 0, MAX_AMOUNT),
    lateFeePerDay: amountError(state.lateFeePerDay, 0, MAX_AMOUNT),
    replacementValue: amountError(state.replacementValue, 0, MAX_AMOUNT),
    maxRentalDays: rentalDaysError(state.maxRentalDays),
    pickupLocations: pickupError(state.pickupLocations),
    blackouts: blackoutsError(state.blackouts, now),
    photos: photosError(state.photos),
  };
  return Object.fromEntries(
    Object.entries(errors).filter(([, message]) => message !== undefined),
  );
}

function satang(text: string): number {
  const value = bahtToSatang(text);
  if (value === null) throw new Error(`Invalid amount: ${text}`);
  return value;
}

/** Builds the request body. Call it only after validateListingForm found no errors. */
export function toCreateBody(state: ListingFormState): CreateListingBody {
  if (!state.category || !state.condition || state.photos.length === 0) {
    throw new Error('The form is incomplete.');
  }
  return {
    title: state.title.trim(),
    category: state.category,
    description: state.description.trim(),
    condition: state.condition,
    accessories: parseAccessories(state.accessories),
    replacementValue: satang(state.replacementValue),
    dailyRate: satang(state.dailyRate),
    deposit: satang(state.deposit),
    lateFeePerDay: satang(state.lateFeePerDay),
    maxRentalDays: Number(state.maxRentalDays.trim()),
    pickupLocations: state.pickupLocations,
    blackouts: state.blackouts.map((row) => {
      const range = dateInputToBangkokRange(row.firstDay, row.lastDay);
      if (!range) throw new Error('An unavailable period is invalid.');
      return range;
    }),
    photos: state.photos.map((photo) => photo.dataUrl),
    thumbnail: state.photos[0].thumbnail,
  };
}
