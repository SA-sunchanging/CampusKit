import { currentCorrelationId } from '@app/common';
import { recordMetrics } from '@app/common/testing/metric-recorder.js';
import { Logger } from '@nestjs/common';
import type { ConsumeMessage } from 'amqplib';
import type { Model } from 'mongoose';
import { DEAD_LETTERS_METRIC } from '../metrics.js';
import { DeadLetterStoreService } from './dead-letter-store.service.js';
import type { DeadLetter } from './dead-letter.schema.js';

const message = {
  content: Buffer.from(
    JSON.stringify({ type: 'booking.requested', correlationId: 'corr-1' }),
  ),
  fields: { routingKey: 'booking.requested' },
  properties: {
    headers: {
      'x-death': [
        { reason: 'rejected', queue: 'notification.inbox', count: 1 },
      ],
    },
  },
} as unknown as ConsumeMessage;

function setup(write: () => Promise<unknown> = () => Promise.resolve({})) {
  const ids: (string | undefined)[] = [];
  const model = {
    updateOne: vi.fn(
      (_filter: unknown, _update: unknown, _options: unknown) => ({
        exec: () => {
          ids.push(currentCorrelationId());
          return write();
        },
      }),
    ),
  };
  const channel = { ack: vi.fn(), nack: vi.fn() };
  const service = new DeadLetterStoreService(
    model as unknown as Model<DeadLetter>,
  );
  return { service, model, channel, ids };
}

beforeEach(() => {
  vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('DeadLetterStoreService.keep', () => {
  it('stores the dead letter once by key, then acks', async () => {
    const { service, model, channel } = setup();
    await service.keep(channel, message);
    const [filter, update, options] = model.updateOne.mock.calls[0];
    const letter = (update as { $setOnInsert: { key: string } }).$setOnInsert;
    expect(filter).toEqual({ key: letter.key });
    expect(letter).toMatchObject({
      type: 'booking.requested',
      correlationId: 'corr-1',
      reason: 'rejected',
      queue: 'notification.inbox',
    });
    expect(options).toEqual({ upsert: true });
    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it("stores under the event's correlation ID", async () => {
    const { service, channel, ids } = setup();
    await service.keep(channel, message);
    expect(ids).toEqual(['corr-1']);
  });

  it('requeues the message when MongoDB fails', async () => {
    const { service, channel } = setup(() =>
      Promise.reject(new Error('mongo down')),
    );
    await service.keep(channel, message);
    expect(channel.ack).not.toHaveBeenCalled();
    expect(channel.nack).toHaveBeenCalledWith(message, false, true);
  });
});

describe('DeadLetterStoreService.keep metrics', () => {
  const recorder = recordMetrics();
  afterAll(() => recorder.stop());

  /** Letters counted so far; the provider is installed while the file loads. */
  async function kept(): Promise<number> {
    const [point] = await recorder.points(DEAD_LETTERS_METRIC);
    return Number(point?.value ?? 0);
  }

  it('counts a kept letter but not a requeued one', async () => {
    const before = await kept();
    const working = setup();
    await working.service.keep(working.channel, message);
    const failing = setup(() => Promise.reject(new Error('mongo down')));
    await failing.service.keep(failing.channel, message);
    expect((await kept()) - before).toBe(1);
  });
});
