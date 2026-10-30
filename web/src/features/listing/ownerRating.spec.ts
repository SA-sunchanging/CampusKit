import { describe, expect, it } from 'vitest';
import { ownerLine, ownerRatingLabel } from './ownerRating.ts';

describe('ownerRatingLabel', () => {
  it('shows the rating to one decimal and the number of reviews', () => {
    expect(ownerRatingLabel(4.5, 12)).toBe('4.5 ★ (12)');
    expect(ownerRatingLabel(4, 1)).toBe('4.0 ★ (1)');
  });

  it('says there are no reviews without a rating', () => {
    expect(ownerRatingLabel(null, 0)).toBe('No reviews yet');
  });
});

describe('ownerLine', () => {
  it('adds the rating to the owner name', () => {
    expect(ownerLine('Somchai', 4.5, 12)).toBe(
      'Listed by Somchai - 4.5 ★ (12)',
    );
    expect(ownerLine('Somchai', null, 0)).toBe(
      'Listed by Somchai - No reviews yet',
    );
  });

  it('shows only the name when the rating is not known', () => {
    expect(ownerLine('Somchai', undefined, undefined)).toBe(
      'Listed by Somchai',
    );
  });
});
