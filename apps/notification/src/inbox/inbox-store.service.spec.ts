import type { Mock } from 'vitest';
import type { Model } from 'mongoose';
import type { InboxEnvelope } from './envelope.js';
import type { InboxEntry } from './inbox-entry.schema.js';
import { InboxStoreService } from './inbox-store.service.js';

const EVENT_ID = '11111111-1111-4111-8111-111111111111';
const OWNER_ID = '22222222-2222-4222-8222-222222222222';
const RENTER_ID = '33333333-3333-4333-8333-333333333333';

function envelope(overrides: Partial<InboxEnvelope> = {}): InboxEnvelope {
  return {
    eventId: EVENT_ID,
    type: 'booking.confirmed',
    occurredAt: '2026-10-29T08:00:00.000Z',
    correlationId: 'corr-1',
    producer: 'booking',
    recipients: [OWNER_ID, RENTER_ID],
    data: { bookingId: 'b-1' },
    ...overrides,
  };
}

type BulkWrite = (writes: unknown[], options: unknown) => Promise<unknown>;

function setup(bulkWrite = vi.fn<BulkWrite>(() => Promise.resolve({}))) {
  const service = new InboxStoreService({
    bulkWrite,
  } as unknown as Model<InboxEntry>);
  return { service, bulkWrite };
}

interface UpsertOp {
  updateOne: {
    filter: Record<string, unknown>;
    update: { $setOnInsert: Record<string, unknown> };
    upsert: boolean;
  };
}

function writesOf(bulkWrite: Mock<BulkWrite>): UpsertOp[] {
  return bulkWrite.mock.calls[0][0] as UpsertOp[];
}

describe('InboxStoreService', () => {
  it('upserts one entry per recipient in a single bulk write', async () => {
    const { service, bulkWrite } = setup();
    await service.store(envelope());
    expect(bulkWrite).toHaveBeenCalledTimes(1);
    const writes = writesOf(bulkWrite);
    expect(writes.map((op) => op.updateOne.filter)).toEqual([
      { eventId: EVENT_ID, recipient: OWNER_ID },
      { eventId: EVENT_ID, recipient: RENTER_ID },
    ]);
    expect(writes.every((op) => op.updateOne.upsert)).toBe(true);
    expect(bulkWrite.mock.calls[0][1]).toEqual({
      ordered: false,
      timestamps: false,
    });
  });

  it('only sets fields on insert, so a redelivery changes nothing', async () => {
    const { service, bulkWrite } = setup();
    await service.store(envelope());
    const { update } = writesOf(bulkWrite)[0].updateOne;
    expect(Object.keys(update)).toEqual(['$setOnInsert']);
    expect(update.$setOnInsert).toMatchObject({
      eventId: EVENT_ID,
      recipient: OWNER_ID,
      type: 'booking.confirmed',
      occurredAt: new Date('2026-10-29T08:00:00.000Z'),
      data: { bookingId: 'b-1' },
    });
    expect(update.$setOnInsert).not.toHaveProperty('readAt');
  });

  it('stores IDs in lower case and each recipient once', async () => {
    const { service, bulkWrite } = setup();
    await service.store(
      envelope({
        eventId: EVENT_ID.toUpperCase(),
        recipients: [OWNER_ID, OWNER_ID.toUpperCase()],
      }),
    );
    expect(writesOf(bulkWrite).map((op) => op.updateOne.filter)).toEqual([
      { eventId: EVENT_ID, recipient: OWNER_ID },
    ]);
  });

  it('writes nothing for an event without recipients', async () => {
    const { service, bulkWrite } = setup();
    await service.store(envelope({ recipients: [] }));
    expect(bulkWrite).not.toHaveBeenCalled();
  });

  it('passes a storage failure on so the message is requeued', async () => {
    const { service } = setup(
      vi.fn<BulkWrite>(() => Promise.reject(new Error('down'))),
    );
    await expect(service.store(envelope())).rejects.toThrow('down');
  });
});
