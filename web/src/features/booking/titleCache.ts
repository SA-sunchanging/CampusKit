/** Remembers listing titles for the session, so each listing is fetched once. */
export interface TitleCache {
  /** The title, or null when the listing cannot be loaded (tried again next time). */
  get(listingId: string): Promise<string | null>;
}

export function createTitleCache(
  load: (listingId: string) => Promise<string>,
): TitleCache {
  const titles = new Map<string, Promise<string | null>>();
  return {
    get(listingId) {
      const known = titles.get(listingId);
      if (known) return known;
      const title = load(listingId).catch(() => {
        titles.delete(listingId);
        return null;
      });
      titles.set(listingId, title);
      return title;
    },
  };
}
