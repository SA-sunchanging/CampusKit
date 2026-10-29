import { describe, expect, it } from 'vitest';
import { readPath } from './notification.ts';

describe('readPath', () => {
  it('puts the event ID in the path', () => {
    expect(readPath('e-1')).toBe('/notification/inbox/e-1/read');
  });

  it('escapes characters that would change the path', () => {
    expect(readPath('a/b?c')).toBe('/notification/inbox/a%2Fb%3Fc/read');
  });
});
