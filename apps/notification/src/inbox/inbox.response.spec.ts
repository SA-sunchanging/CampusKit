import { Types } from 'mongoose';
import type { InboxEntryRecord } from './inbox-entry.schema.js';
import {
  InboxEntryResponse,
  InboxListResponse,
  UnreadCountResponse,
} from './inbox.response.js';

function record(overrides: Partial<InboxEntryRecord> = {}): InboxEntryRecord {
  return {
    _id: new Types.ObjectId(),
    eventId: '11111111-1111-4111-8111-111111111111',
    recipient: '22222222-2222-4222-8222-222222222222',
    type: 'rental.started',
    occurredAt: new Date('2026-10-29T08:00:00.000Z'),
    data: { rentalId: 'r-1' },
    ...overrides,
  };
}

describe('InboxEntryResponse', () => {
  it('shows an unread entry with an empty readAt', () => {
    expect(InboxEntryResponse.of(record())).toEqual({
      eventId: '11111111-1111-4111-8111-111111111111',
      type: 'rental.started',
      occurredAt: '2026-10-29T08:00:00.000Z',
      data: { rentalId: 'r-1' },
      read: false,
      readAt: '',
    });
  });

  it('treats a null readAt as unread', () => {
    expect(InboxEntryResponse.of(record({ readAt: null }))).toMatchObject({
      read: false,
      readAt: '',
    });
  });

  it('shows when a read entry was read', () => {
    const readAt = new Date('2026-10-29T09:30:00.000Z');
    expect(InboxEntryResponse.of(record({ readAt }))).toMatchObject({
      read: true,
      readAt: '2026-10-29T09:30:00.000Z',
    });
  });
});

describe('InboxListResponse', () => {
  it('maps the entries and keeps the unread count', () => {
    const list = InboxListResponse.of([record(), record()], 5);
    expect(list.entries).toHaveLength(2);
    expect(list.unread).toBe(5);
  });
});

describe('UnreadCountResponse', () => {
  it('carries the count', () => {
    expect(UnreadCountResponse.of(3)).toEqual({ unread: 3 });
  });
});
