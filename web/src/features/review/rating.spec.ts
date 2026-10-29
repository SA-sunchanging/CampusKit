import { describe, expect, it } from 'vitest';
import { ratingOption, reputationText, stars } from './rating.ts';

describe('stars', () => {
  it('fills one star per point out of five', () => {
    expect(stars(4)).toBe('★★★★☆');
    expect(stars(1)).toBe('★☆☆☆☆');
  });
});

describe('ratingOption', () => {
  it('names the rating', () => {
    expect(ratingOption(5)).toBe('5 - Excellent');
  });
});

describe('reputationText', () => {
  it('says when there are no reviews', () => {
    expect(reputationText(null, 0)).toBe('No reviews yet');
  });

  it('shows one decimal and the count', () => {
    expect(reputationText(4, 1)).toBe('4.0 out of 5 from 1 review');
    expect(reputationText(4.5, 12)).toBe('4.5 out of 5 from 12 reviews');
  });
});
