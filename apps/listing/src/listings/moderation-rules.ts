import type { Listing } from './listing.entity.js';

/** A replacement value of 10,000 THB (in satang) or more needs an administrator's approval. */
export const REVIEW_VALUE = 1_000_000;

/**
 * Words that send a listing to review: weapons, drugs, alcohol, and counterfeit goods. English
 * words match whole words only, so "gun" does not flag "begun"; list plurals separately.
 */
export const REVIEW_WORDS: readonly string[] = [
  'weapon',
  'weapons',
  'gun',
  'guns',
  'firearm',
  'firearms',
  'drug',
  'drugs',
  'cannabis',
  'alcohol',
  'liquor',
  'vape',
  'counterfeit',
  'replica',
];

/**
 * Thai words for the same goods. Thai is written without spaces between words, so these match
 * anywhere in the text. A false match only sends the listing to review.
 */
export const REVIEW_WORDS_THAI: readonly string[] = [
  'อาวุธ',
  'ปืน',
  'ยาเสพติด',
  'กัญชา',
  'เหล้า',
  'บุหรี่ไฟฟ้า',
  'ของปลอม',
];

/** A word with no letter or digit directly before or after it, ignoring case. */
function wholeWord(word: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])${word}(?![\\p{L}\\p{N}])`, 'iu');
}

const ENGLISH_PATTERNS = REVIEW_WORDS.map((word) => ({
  word,
  pattern: wholeWord(word),
}));

/**
 * Why a listing must wait for an administrator before it is published; empty when it can be
 * published at once. The administrator's queue shows these reasons.
 */
export function moderationFlags(
  listing: Pick<Listing, 'title' | 'description' | 'replacementValue'>,
): string[] {
  const flags: string[] = [];
  if (listing.replacementValue >= REVIEW_VALUE) {
    flags.push('Replacement value is 10,000 THB or more');
  }
  const text = `${listing.title}\n${listing.description}`;
  const english = ENGLISH_PATTERNS.filter(({ pattern }) => pattern.test(text));
  const thai = REVIEW_WORDS_THAI.filter((word) => text.includes(word));
  for (const word of [...english.map(({ word }) => word), ...thai]) {
    flags.push(`Mentions "${word}"`);
  }
  return flags;
}
