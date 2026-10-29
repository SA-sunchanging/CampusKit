import { describe, expect, it } from 'vitest';
import { badgeLabel, INBOX_CHANGED, UNREAD_POLL_MS } from './useUnreadCount.ts';

describe('badgeLabel', () => {
  it('hides the badge when nothing is unread', () => {
    expect(badgeLabel(0)).toBe('');
  });

  it('shows the count up to 99', () => {
    expect(badgeLabel(1)).toBe('1');
    expect(badgeLabel(99)).toBe('99');
  });

  it('caps the count above 99', () => {
    expect(badgeLabel(100)).toBe('99+');
    expect(badgeLabel(12345)).toBe('99+');
  });

  it('hides the badge for a value that is not a count', () => {
    expect(badgeLabel(-1)).toBe('');
    expect(badgeLabel(Number.NaN)).toBe('');
  });
});

describe('constants', () => {
  it('names the event the inbox page fires', () => {
    expect(INBOX_CHANGED).toBe('inbox:changed');
  });

  it('polls every 30 seconds', () => {
    expect(UNREAD_POLL_MS).toBe(30_000);
  });
});
