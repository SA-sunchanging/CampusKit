import { describe, expect, it, vi } from 'vitest';
import { createTitleCache } from './titleCache.ts';

describe('createTitleCache', () => {
  it('loads each listing once', async () => {
    const load = vi.fn(async (id: string) => `Title ${id}`);
    const cache = createTitleCache(load);
    const [first, second] = await Promise.all([cache.get('a'), cache.get('a')]);
    expect(first).toBe('Title a');
    expect(second).toBe('Title a');
    await expect(cache.get('a')).resolves.toBe('Title a');
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('answers null for a failed lookup and tries again later', async () => {
    const load = vi
      .fn<(id: string) => Promise<string>>()
      .mockRejectedValueOnce(new Error('Listing not found'))
      .mockResolvedValueOnce('Back again');
    const cache = createTitleCache(load);
    await expect(cache.get('a')).resolves.toBeNull();
    await expect(cache.get('a')).resolves.toBe('Back again');
    expect(load).toHaveBeenCalledTimes(2);
  });
});
