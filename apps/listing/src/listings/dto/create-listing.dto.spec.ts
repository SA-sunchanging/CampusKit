import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateListingDto } from './create-listing.dto.js';

const photo = 'data:image/jpeg;base64,AAAA';

const valid = {
  title: '  Calculus I textbook ',
  category: 'BOOKS',
  description: 'Clean copy with a few pencil notes.',
  condition: 'GOOD',
  accessories: ['Solution manual'],
  replacementValue: 120000,
  dailyRate: 2000,
  deposit: 30000,
  lateFeePerDay: 4000,
  maxRentalDays: 7,
  pickupLocations: ['ENGINEERING'],
  blackouts: [{ start: '2026-11-01T17:00:00Z', end: '2026-11-03T17:00:00Z' }],
  photos: [photo],
  thumbnail: photo,
};

function errorsFor(fields: Record<string, unknown>): string[] {
  const dto = plainToInstance(CreateListingDto, { ...valid, ...fields });
  return validateSync(dto).map((error) => error.property);
}

describe('CreateListingDto', () => {
  it('accepts a complete listing and trims the title', () => {
    const dto = plainToInstance(CreateListingDto, valid);
    expect(validateSync(dto)).toEqual([]);
    expect(dto.title).toBe('Calculus I textbook');
  });

  it.each([
    ['title', 'ab'],
    ['category', 'CARS'],
    ['description', 'short'],
    ['condition', 'BROKEN'],
    ['accessories', Array.from({ length: 11 }, () => 'cable')],
    ['dailyRate', 0],
    ['dailyRate', 10_000_001],
    ['deposit', -1],
    ['deposit', 12.5],
    ['maxRentalDays', 31],
    ['pickupLocations', []],
    ['pickupLocations', ['ARTS', 'ARTS']],
    ['pickupLocations', ['MARS']],
    ['blackouts', [{ start: 'tomorrow', end: '2026-11-03T17:00:00Z' }]],
    ['photos', []],
    ['photos', ['https://example.com/a.jpg']],
    ['photos', Array.from({ length: 6 }, () => photo)],
    ['thumbnail', 'data:text/plain;base64,AAAA'],
  ])('rejects an invalid %s', (field, value) => {
    expect(errorsFor({ [field]: value })).toContain(field);
  });
});
