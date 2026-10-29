import type { AuthUser } from '@app/common';
import { ForbiddenException } from '@nestjs/common';
import { Types, type Model } from 'mongoose';
import { DeadLetterQueriesService } from './dead-letter-queries.service.js';
import type { DeadLetter, DeadLetterRecord } from './dead-letter.schema.js';
import { DeadLettersQuery } from './dto/dead-letters.query.js';

const admin: AuthUser = {
  sub: '11111111-1111-4111-8111-111111111111',
  role: 'admin',
};
const student: AuthUser = { ...admin, role: 'student' };

function record(overrides: Partial<DeadLetterRecord> = {}): DeadLetterRecord {
  return {
    _id: new Types.ObjectId(),
    key: 'k',
    content: '{not json',
    size: 9,
    routingKey: 'booking.requested',
    receivedAt: new Date('2026-10-29T09:00:00.000Z'),
    ...overrides,
  };
}

/** A Mongoose query stand-in: every builder method returns itself; exec resolves the result. */
function query(result: unknown) {
  const chain = {
    sort: vi.fn(() => chain),
    skip: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    lean: vi.fn(() => chain),
    exec: vi.fn(() => Promise.resolve(result)),
  };
  return chain;
}

function setup(rows: DeadLetterRecord[] = [record()], total = 1) {
  const finds = query(rows);
  const model = {
    find: vi.fn(() => finds),
    countDocuments: vi.fn(() => query(total)),
  };
  const service = new DeadLetterQueriesService(
    model as unknown as Model<DeadLetter>,
  );
  return { service, model, finds };
}

const page = (values: Partial<DeadLettersQuery> = {}) =>
  Object.assign(new DeadLettersQuery(), values);

describe('DeadLetterQueriesService.list', () => {
  it('lists a page of dead letters, newest first, for an administrator', async () => {
    const { service, finds } = setup([record()], 31);
    const list = await service.list(admin, page({ page: 2, pageSize: 10 }));
    expect(finds.sort).toHaveBeenCalledWith({ receivedAt: -1, _id: -1 });
    expect(finds.skip).toHaveBeenCalledWith(10);
    expect(finds.limit).toHaveBeenCalledWith(10);
    expect(list).toMatchObject({ total: 31, page: 2, pageSize: 10 });
    expect(list.items).toHaveLength(1);
  });

  it('defaults to the first page of 20', async () => {
    const { service, finds } = setup();
    await service.list(admin, page());
    expect(finds.skip).toHaveBeenCalledWith(0);
    expect(finds.limit).toHaveBeenCalledWith(20);
  });

  it('refuses a student with 403 without reading', async () => {
    const { service, model } = setup();
    await expect(service.list(student, page())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(model.find).not.toHaveBeenCalled();
    expect(model.countDocuments).not.toHaveBeenCalled();
  });

  it('answers missing fields as empty text and a zero count', async () => {
    const { service } = setup([record()]);
    const [item] = (await service.list(admin, page())).items;
    expect(item).toMatchObject({
      eventId: '',
      type: '',
      correlationId: '',
      reason: '',
      queue: '',
      count: 0,
      deadLetteredAt: '',
      receivedAt: '2026-10-29T09:00:00.000Z',
      content: '{not json',
      size: 9,
    });
  });

  it('answers the fields a dead letter carries', async () => {
    const { service } = setup([
      record({
        eventId: 'e-1',
        type: 'booking.requested',
        correlationId: 'corr-1',
        reason: 'rejected',
        queue: 'notification.inbox',
        count: 2,
        deadLetteredAt: new Date('2026-10-29T08:00:00.000Z'),
      }),
    ]);
    const [item] = (await service.list(admin, page())).items;
    expect(item).toMatchObject({
      eventId: 'e-1',
      type: 'booking.requested',
      correlationId: 'corr-1',
      reason: 'rejected',
      queue: 'notification.inbox',
      count: 2,
      deadLetteredAt: '2026-10-29T08:00:00.000Z',
    });
  });
});
