import type { AuthUser } from '@app/common';
import { NotFoundException } from '@nestjs/common';
import { Types, type Model } from 'mongoose';
import type { InboxEntry, InboxEntryRecord } from './inbox-entry.schema.js';
import { InboxQueriesService, LIST_LIMIT } from './inbox-queries.service.js';

const USER_ID = '22222222-2222-4222-8222-222222222222';
const EVENT_ID = '11111111-1111-4111-8111-111111111111';
const caller: AuthUser = { sub: USER_ID, role: 'student' };
const READ_AT = new Date('2026-10-29T09:00:00.000Z');

function record(overrides: Partial<InboxEntryRecord> = {}): InboxEntryRecord {
  return {
    _id: new Types.ObjectId(),
    eventId: EVENT_ID,
    recipient: USER_ID,
    type: 'booking.requested',
    occurredAt: new Date('2026-10-29T08:00:00.000Z'),
    data: { bookingId: 'b-1' },
    ...overrides,
  };
}

/** A Mongoose query stand-in: every builder method returns itself; exec resolves the result. */
function query(result: unknown) {
  const chain = {
    sort: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    lean: vi.fn(() => chain),
    exec: vi.fn(() => Promise.resolve(result)),
  };
  return chain;
}

function setup(
  results: {
    find?: unknown;
    count?: number;
    findOneAndUpdate?: unknown;
    findOne?: unknown;
  } = {},
) {
  const finds = query(results.find ?? []);
  const model = {
    find: vi.fn(() => finds),
    countDocuments: vi.fn(() => query(results.count ?? 0)),
    findOneAndUpdate: vi.fn((_filter: unknown, _update: unknown) =>
      query(results.findOneAndUpdate ?? null),
    ),
    findOne: vi.fn(() => query(results.findOne ?? null)),
    updateMany: vi.fn((_filter: unknown, _update: unknown) =>
      query({ modifiedCount: 3 }),
    ),
  };
  const service = new InboxQueriesService(
    model as unknown as Model<InboxEntry>,
  );
  return { service, model, finds };
}

describe('InboxQueriesService', () => {
  describe('list', () => {
    it("lists only the caller's newest entries", async () => {
      const { service, model, finds } = setup({ find: [record()], count: 7 });
      const list = await service.list(caller);
      expect(model.find).toHaveBeenCalledWith({ recipient: USER_ID });
      expect(finds.sort).toHaveBeenCalledWith({ occurredAt: -1, _id: -1 });
      expect(finds.limit).toHaveBeenCalledWith(LIST_LIMIT);
      expect(LIST_LIMIT).toBe(50);
      expect(list.entries.map((entry) => entry.eventId)).toEqual([EVENT_ID]);
      expect(list.unread).toBe(7);
    });

    it('counts all unread entries of the caller', async () => {
      const { service, model } = setup();
      await service.list(caller);
      expect(model.countDocuments).toHaveBeenCalledWith({
        recipient: USER_ID,
        readAt: null,
      });
    });

    it('matches the caller in lower case', async () => {
      const { service, model } = setup();
      await service.list({ ...caller, sub: USER_ID.toUpperCase() });
      expect(model.find).toHaveBeenCalledWith({ recipient: USER_ID });
    });
  });

  describe('unreadCount', () => {
    it("counts the caller's unread entries", async () => {
      const { service, model } = setup({ count: 4 });
      await expect(service.unreadCount(caller)).resolves.toEqual({
        unread: 4,
      });
      expect(model.countDocuments).toHaveBeenCalledWith({
        recipient: USER_ID,
        readAt: null,
      });
    });
  });

  describe('markRead', () => {
    it('sets readAt on an unread entry of the caller', async () => {
      const { service, model } = setup({
        findOneAndUpdate: record({ readAt: READ_AT }),
      });
      const entry = await service.markRead(caller, EVENT_ID);
      expect(entry).toMatchObject({
        eventId: EVENT_ID,
        read: true,
        readAt: READ_AT.toISOString(),
      });
      const [filter, update] = model.findOneAndUpdate.mock.calls[0] as [
        unknown,
        { $set: { readAt: unknown } },
      ];
      expect(filter).toEqual({
        eventId: EVENT_ID,
        recipient: USER_ID,
        readAt: null,
      });
      expect(update.$set.readAt).toBeInstanceOf(Date);
      expect(model.findOne).not.toHaveBeenCalled();
    });

    it('keeps the first readAt when the entry is already read', async () => {
      const { service, model } = setup({
        findOneAndUpdate: null,
        findOne: record({ readAt: READ_AT }),
      });
      const entry = await service.markRead(caller, EVENT_ID.toUpperCase());
      expect(entry.readAt).toBe(READ_AT.toISOString());
      expect(model.findOne).toHaveBeenCalledWith({
        eventId: EVENT_ID,
        recipient: USER_ID,
      });
    });

    it("answers 404 for a missing entry or another user's", async () => {
      const { service } = setup({ findOneAndUpdate: null, findOne: null });
      const result = service.markRead(caller, EVENT_ID);
      await expect(result).rejects.toBeInstanceOf(NotFoundException);
      await expect(result).rejects.toThrow('Notice not found');
    });
  });

  describe('markAllRead', () => {
    it('marks every unread entry of the caller read', async () => {
      const { service, model } = setup();
      await expect(service.markAllRead(caller)).resolves.toEqual({
        unread: 0,
      });
      const [filter, update] = model.updateMany.mock.calls[0] as [
        unknown,
        { $set: { readAt: unknown } },
      ];
      expect(filter).toEqual({ recipient: USER_ID, readAt: null });
      expect(update.$set.readAt).toBeInstanceOf(Date);
    });
  });
});
