import { isUUID } from 'class-validator';
import type { EntityManager } from 'typeorm';
import { writeOutbox } from './outbox.js';

describe('writeOutbox', () => {
  it('stores the envelope in the transaction with its eventId as row ID', async () => {
    const query = vi.fn().mockResolvedValue([]);
    const now = new Date('2026-10-29T05:00:00Z');
    const envelope = await writeOutbox(
      { query } as unknown as EntityManager,
      {
        producer: 'booking',
        type: 'booking.requested',
        recipients: ['owner-1'],
        correlationId: 'corr-1',
        data: { bookingId: 'b1' },
      },
      now,
    );
    expect(isUUID(envelope.eventId)).toBe(true);
    expect(envelope).toMatchObject({
      type: 'booking.requested',
      occurredAt: '2026-10-29T05:00:00.000Z',
      correlationId: 'corr-1',
      producer: 'booking',
      recipients: ['owner-1'],
      data: { bookingId: 'b1' },
    });
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('INSERT INTO outbox_events');
    expect(params[0]).toBe(envelope.eventId);
    expect(params[1]).toBe('booking.requested');
    expect(JSON.parse(params[2] as string)).toEqual(envelope);
  });

  it('names the producer the caller gives', async () => {
    const query = vi.fn().mockResolvedValue([]);
    const envelope = await writeOutbox({ query } as unknown as EntityManager, {
      producer: 'listing',
      type: 'listing.published',
      recipients: ['owner-1'],
      correlationId: 'corr-2',
      data: { listingId: 'l1' },
    });
    expect(envelope.producer).toBe('listing');
    const [, params] = query.mock.calls[0] as [string, unknown[]];
    expect(JSON.parse(params[2] as string)).toMatchObject({
      producer: 'listing',
    });
  });
});
