// The owner's reputation on listing cards and the detail page (role B), as
// Review reports it through the Listing service.

/** 4.5 and 12 -> "4.5 ★ (12)"; "No reviews yet" without a rating. */
export function ownerRatingLabel(rating: number | null, count: number): string {
  if (rating === null || count === 0) return 'No reviews yet';
  return `${rating.toFixed(1)} ★ (${count})`;
}

/** "Listed by Somchai - 4.5 ★ (12)"; only the name when the rating is not known. */
export function ownerLine(
  ownerName: string,
  rating: number | null | undefined,
  count: number | undefined,
): string {
  const listedBy = `Listed by ${ownerName}`;
  if (rating === undefined || count === undefined) return listedBy;
  return `${listedBy} - ${ownerRatingLabel(rating, count)}`;
}
