// Text for ratings (role E). Ratings are whole stars from 1 to 5.

export const RATINGS = [5, 4, 3, 2, 1] as const;

const WORDS: Record<number, string> = {
  5: 'Excellent',
  4: 'Good',
  3: 'Okay',
  2: 'Poor',
  1: 'Bad',
};

/** 4 -> "★★★★☆". */
export function stars(rating: number): string {
  return '★'.repeat(rating) + '☆'.repeat(5 - rating);
}

/** 4 -> "4 - Good", for the rating picker. */
export function ratingOption(rating: number): string {
  return `${rating} - ${WORDS[rating]}`;
}

/** The average and how many reviews it comes from, or a note that there are none. */
export function reputationText(average: number | null, count: number): string {
  if (average === null || count === 0) return 'No reviews yet';
  const reviews = count === 1 ? '1 review' : `${count} reviews`;
  return `${average.toFixed(1)} out of 5 from ${reviews}`;
}
