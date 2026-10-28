import { describe, expect, it } from 'vitest';
import {
  bahtToSatang,
  bangkokToday,
  dateInputToBangkokRange,
  EMPTY_FORM,
  type ListingFormState,
  parseAccessories,
  toCreateBody,
  validateListingForm,
} from './listingForm.ts';

const NOW = new Date('2026-10-28T05:00:00Z');
const PHOTO = 'data:image/jpeg;base64,QUJD';
const THUMB = 'data:image/jpeg;base64,QQ==';

const VALID: ListingFormState = {
  title: '  Calculus I textbook ',
  category: 'BOOKS',
  description: 'Clean copy with a few pencil notes.',
  condition: 'GOOD',
  accessories: 'Solution manual, bookmark\nCover',
  dailyRate: '20',
  deposit: '300.50',
  lateFeePerDay: '40',
  replacementValue: '1,200',
  maxRentalDays: '7',
  pickupLocations: ['ENGINEERING', 'CENTRAL_LIBRARY'],
  blackouts: [{ key: 1, firstDay: '2026-11-01', lastDay: '2026-11-02' }],
  photos: [{ key: 1, dataUrl: PHOTO, thumbnail: THUMB }],
};

describe('bahtToSatang', () => {
  it.each([
    ['150', 15000],
    ['150.5', 15050],
    ['150.05', 15005],
    [' 0 ', 0],
    ['1,250.75', 125075],
    ['1000000', 100000000],
  ])('reads %j as %i satang', (text, satang) => {
    expect(bahtToSatang(text)).toBe(satang);
  });

  it.each(['', '  ', '-5', '1.234', 'abc', '12abc', '.5', '5.', '1,2', '1e3'])(
    'rejects %j',
    (text) => {
      expect(bahtToSatang(text)).toBeNull();
    },
  );
});

describe('parseAccessories', () => {
  it('splits on commas and new lines and drops blanks', () => {
    expect(parseAccessories(' case, ,strap\n\ncharger ')).toEqual([
      'case',
      'strap',
      'charger',
    ]);
  });
});

describe('dateInputToBangkokRange', () => {
  it('starts at midnight Bangkok and ends the midnight after the last day', () => {
    expect(dateInputToBangkokRange('2026-11-01', '2026-11-02')).toEqual({
      start: '2026-10-31T17:00:00.000Z',
      end: '2026-11-02T17:00:00.000Z',
    });
  });

  it('covers a single day', () => {
    expect(dateInputToBangkokRange('2026-12-31', '2026-12-31')).toEqual({
      start: '2026-12-30T17:00:00.000Z',
      end: '2026-12-31T17:00:00.000Z',
    });
  });

  it('crosses a month end', () => {
    expect(dateInputToBangkokRange('2027-02-27', '2027-02-28')?.end).toBe(
      '2027-02-28T17:00:00.000Z',
    );
  });

  it('rejects a last day before the first', () => {
    expect(dateInputToBangkokRange('2026-11-02', '2026-11-01')).toBeNull();
  });

  it.each([
    ['', '2026-11-01'],
    ['2026-02-30', '2026-03-01'],
    ['2026-11-01', 'tomorrow'],
  ])('rejects invalid days %j and %j', (first, last) => {
    expect(dateInputToBangkokRange(first, last)).toBeNull();
  });
});

describe('bangkokToday', () => {
  it('is already the next day after 17:00 UTC', () => {
    expect(bangkokToday(new Date('2026-10-28T17:00:00Z'))).toBe('2026-10-29');
    expect(bangkokToday(new Date('2026-10-28T16:59:59Z'))).toBe('2026-10-28');
  });
});

describe('validateListingForm', () => {
  it('accepts a complete form', () => {
    expect(validateListingForm(VALID, NOW)).toEqual({});
  });

  it('reports every missing field of an empty form', () => {
    expect(Object.keys(validateListingForm(EMPTY_FORM, NOW)).sort()).toEqual([
      'category',
      'condition',
      'dailyRate',
      'deposit',
      'description',
      'lateFeePerDay',
      'photos',
      'pickupLocations',
      'replacementValue',
      'title',
    ]);
  });

  it('checks text lengths after trimming', () => {
    const errors = validateListingForm(
      { ...VALID, title: '  ab  ', description: 'too short' },
      NOW,
    );
    expect(errors.title).toBe('The title must be 3 to 100 characters.');
    expect(errors.description).toBe(
      'The description must be 10 to 2000 characters.',
    );
  });

  it('needs a daily rate above zero and amounts within the limits', () => {
    const errors = validateListingForm(
      { ...VALID, dailyRate: '0', deposit: '1000000.01', lateFeePerDay: '-1' },
      NOW,
    );
    expect(errors.dailyRate).toBe('Enter at least 0.01 baht.');
    expect(errors.deposit).toBe('Enter at most 1,000,000 baht.');
    expect(errors.lateFeePerDay).toMatch(/amount in baht/);
  });

  it('allows the largest daily rate', () => {
    expect(
      validateListingForm({ ...VALID, dailyRate: '100000' }, NOW).dailyRate,
    ).toBeUndefined();
    expect(
      validateListingForm({ ...VALID, dailyRate: '100000.01' }, NOW).dailyRate,
    ).toBeDefined();
  });

  it.each(['0', '31', '2.5', 'seven'])(
    'rejects %j maximum rental days',
    (days) => {
      expect(
        validateListingForm({ ...VALID, maxRentalDays: days }, NOW)
          .maxRentalDays,
      ).toBeDefined();
    },
  );

  it('limits accessories to 10 items of 60 characters', () => {
    const eleven = Array.from({ length: 11 }, (_, i) => `item ${i}`).join(',');
    expect(
      validateListingForm({ ...VALID, accessories: eleven }, NOW).accessories,
    ).toBe('List at most 10 accessories.');
    expect(
      validateListingForm({ ...VALID, accessories: 'x'.repeat(61) }, NOW)
        .accessories,
    ).toBe('Each accessory must be at most 60 characters.');
  });

  it('needs 1 to 3 pickup locations', () => {
    expect(
      validateListingForm(
        {
          ...VALID,
          pickupLocations: [
            'ARTS',
            'SCIENCE',
            'ENGINEERING',
            'CENTRAL_LIBRARY',
          ],
        },
        NOW,
      ).pickupLocations,
    ).toBe('Choose 1 to 3 pickup locations.');
  });

  it('reports an incomplete or reversed unavailable period', () => {
    const missing = { key: 2, firstDay: '2026-11-05', lastDay: '' };
    const reversed = { key: 2, firstDay: '2026-11-05', lastDay: '2026-11-04' };
    expect(
      validateListingForm({ ...VALID, blackouts: [missing] }, NOW).blackouts,
    ).toBe('Unavailable period 1: pick both days.');
    expect(
      validateListingForm(
        { ...VALID, blackouts: [...VALID.blackouts, reversed] },
        NOW,
      ).blackouts,
    ).toBe('Unavailable period 2: the last day must not be before the first.');
  });

  it('rejects overlapping periods but accepts back-to-back ones', () => {
    const touching = { key: 2, firstDay: '2026-11-03', lastDay: '2026-11-04' };
    const overlapping = { ...touching, firstDay: '2026-11-02' };
    expect(
      validateListingForm(
        { ...VALID, blackouts: [touching, ...VALID.blackouts] },
        NOW,
      ).blackouts,
    ).toBeUndefined();
    expect(
      validateListingForm(
        { ...VALID, blackouts: [overlapping, ...VALID.blackouts] },
        NOW,
      ).blackouts,
    ).toBe('Unavailable periods must not overlap.');
  });

  it('needs periods to end within one year', () => {
    const late = { key: 2, firstDay: '2027-10-29', lastDay: '2027-10-30' };
    expect(
      validateListingForm({ ...VALID, blackouts: [late] }, NOW).blackouts,
    ).toBe('Unavailable period 1: must end within one year.');
  });

  it('allows at most 10 unavailable periods', () => {
    const rows = Array.from({ length: 11 }, (_, i) => ({
      key: i,
      firstDay: `2026-12-${String(i + 10)}`,
      lastDay: `2026-12-${String(i + 10)}`,
    }));
    expect(
      validateListingForm({ ...VALID, blackouts: rows }, NOW).blackouts,
    ).toBe('Add at most 10 unavailable periods.');
  });

  it('needs 1 to 5 photos', () => {
    const photo = VALID.photos[0];
    expect(validateListingForm({ ...VALID, photos: [] }, NOW).photos).toBe(
      'Add at least one photo.',
    );
    expect(
      validateListingForm({ ...VALID, photos: Array(6).fill(photo) }, NOW)
        .photos,
    ).toBe('Add at most 5 photos.');
  });
});

describe('toCreateBody', () => {
  it('converts baht to satang, days to a half-open range, and trims text', () => {
    expect(toCreateBody(VALID)).toEqual({
      title: 'Calculus I textbook',
      category: 'BOOKS',
      description: 'Clean copy with a few pencil notes.',
      condition: 'GOOD',
      accessories: ['Solution manual', 'bookmark', 'Cover'],
      replacementValue: 120000,
      dailyRate: 2000,
      deposit: 30050,
      lateFeePerDay: 4000,
      maxRentalDays: 7,
      pickupLocations: ['ENGINEERING', 'CENTRAL_LIBRARY'],
      blackouts: [
        { start: '2026-10-31T17:00:00.000Z', end: '2026-11-02T17:00:00.000Z' },
      ],
      photos: [PHOTO],
      thumbnail: THUMB,
    });
  });

  it('refuses an incomplete form', () => {
    expect(() => toCreateBody(EMPTY_FORM)).toThrow('The form is incomplete.');
  });
});
