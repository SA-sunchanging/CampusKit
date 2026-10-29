import { describe, expect, it } from 'vitest';
import type { Inbox, InboxEntry } from '../../api/notification.ts';
import { withAllRead, withEntryRead } from './inboxState.ts';

const entry = (eventId: string, read: boolean): InboxEntry => ({
  eventId,
  type: 'booking.requested',
  occurredAt: '2026-10-28T03:15:00Z',
  data: {},
  read,
  readAt: read ? '2026-10-28T04:00:00Z' : '',
});

const READ_AT = '2026-10-29T05:00:00Z';

describe('withEntryRead', () => {
  it('replaces the notice and lowers the count', () => {
    const inbox: Inbox = {
      entries: [entry('a', false), entry('b', false)],
      unread: 5,
    };
    const updated = { ...entry('a', true), readAt: READ_AT };
    const next = withEntryRead(inbox, updated);
    expect(next.entries).toEqual([updated, inbox.entries[1]]);
    expect(next.unread).toBe(4);
  });

  it('keeps the count for a notice that was already read', () => {
    const inbox: Inbox = { entries: [entry('a', true)], unread: 2 };
    expect(withEntryRead(inbox, entry('a', true)).unread).toBe(2);
  });

  it('keeps the count for a notice that is not in the list', () => {
    const inbox: Inbox = { entries: [entry('a', false)], unread: 2 };
    const next = withEntryRead(inbox, entry('z', true));
    expect(next.unread).toBe(2);
    expect(next.entries).toEqual(inbox.entries);
  });

  it('never goes below zero', () => {
    const inbox: Inbox = { entries: [entry('a', false)], unread: 0 };
    expect(withEntryRead(inbox, entry('a', true)).unread).toBe(0);
  });
});

describe('withAllRead', () => {
  it('marks every unread notice and keeps earlier read times', () => {
    const inbox: Inbox = {
      entries: [entry('a', false), entry('b', true)],
      unread: 7,
    };
    const next = withAllRead(inbox, 0, READ_AT);
    expect(next.unread).toBe(0);
    expect(next.entries[0]).toMatchObject({ read: true, readAt: READ_AT });
    expect(next.entries[1]).toBe(inbox.entries[1]);
  });
});
