import type { EventPublisher } from './event-publisher.js';
import type { DataSource } from 'typeorm';
import { OutboxRelay } from './outbox-relay.js';

function row(id: string) {
  return { id, envelope: { eventId: id, type: 'booking.requested' } };
}

function setup(rows = [row('e1'), row('e2'), row('e3')]) {
  const log: string[] = [];
  const tx = {
    query: vi.fn((sql: string, params: unknown[] = []) => {
      if (sql.includes('UPDATE outbox_events')) {
        log.push(`mark ${String(params[0])}`);
      }
      return Promise.resolve(sql.includes('SELECT id, envelope') ? rows : []);
    }),
  };
  const db = {
    transaction: vi.fn((work: (manager: typeof tx) => Promise<unknown>) =>
      work(tx),
    ),
  };
  const publisher = {
    publish: vi.fn((event: { eventId: string }) => {
      log.push(`publish ${event.eventId}`);
      return Promise.resolve();
    }),
  };
  const relay = new OutboxRelay(
    db as unknown as DataSource,
    publisher as unknown as EventPublisher,
  );
  return { tx, db, publisher, relay, log };
}

describe('OutboxRelay.relayBatch', () => {
  it('locks up to 50 unsent rows, skipping rows another run holds', async () => {
    const { tx, relay } = setup([]);
    await relay.relayBatch();
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toContain('WHERE sent_at IS NULL');
    expect(sql).toContain('FOR UPDATE SKIP LOCKED');
    expect(params).toEqual([50]);
  });

  it('publishes oldest first and marks each event after the broker confirms', async () => {
    const { relay, log } = setup();
    await expect(relay.relayBatch()).resolves.toBe(3);
    expect(log).toEqual([
      'publish e1',
      'mark e1',
      'publish e2',
      'mark e2',
      'publish e3',
      'mark e3',
    ]);
  });

  it('stops at the first failure and keeps the marks already made', async () => {
    const { relay, publisher, log } = setup();
    publisher.publish
      .mockImplementationOnce(() => {
        log.push('publish e1');
        return Promise.resolve();
      })
      .mockRejectedValueOnce(new Error('broker down'));
    await expect(relay.relayBatch()).resolves.toBe(1);
    expect(log).toEqual(['publish e1', 'mark e1']);
    expect(publisher.publish).toHaveBeenCalledTimes(2);
  });
});

describe('OutboxRelay.tick', () => {
  it('never overlaps its own runs', async () => {
    const { db, relay } = setup();
    let finish: (value: number) => void = () => undefined;
    db.transaction.mockImplementationOnce(
      () => new Promise((resolve) => (finish = resolve)),
    );
    const first = relay.tick();
    await relay.tick();
    expect(db.transaction).toHaveBeenCalledTimes(1);
    finish(0);
    await first;
    await relay.tick();
    expect(db.transaction).toHaveBeenCalledTimes(2);
  });

  it('survives a database failure', async () => {
    const { db, relay } = setup();
    db.transaction.mockRejectedValueOnce(new Error('connection refused'));
    await expect(relay.tick()).resolves.toBeUndefined();
  });
});

describe('OutboxRelay polling', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('polls every second from bootstrap until destroy', async () => {
    vi.useFakeTimers();
    const { db, relay } = setup([]);
    relay.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(db.transaction).toHaveBeenCalledTimes(2);
    relay.onModuleDestroy();
    await vi.advanceTimersByTimeAsync(3_000);
    expect(db.transaction).toHaveBeenCalledTimes(2);
  });
});
