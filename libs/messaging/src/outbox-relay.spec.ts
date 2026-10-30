import { currentCorrelationId } from '@app/common';
import { recordMetrics } from '@app/common/testing/metric-recorder.js';
import { Logger } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import {
  BrokerUnavailableError,
  type EventPublisher,
} from './event-publisher.js';
import { OUTBOX_PENDING_METRIC, OutboxRelay } from './outbox-relay.js';

function row(id: string) {
  return {
    id,
    envelope: {
      eventId: id,
      type: 'booking.requested',
      correlationId: `corr-${id}`,
    },
  };
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

  it("publishes and marks each event under the event's correlation ID", async () => {
    const { relay, publisher, tx } = setup();
    const ids: (string | undefined)[] = [];
    publisher.publish.mockImplementation(() => {
      ids.push(currentCorrelationId());
      return Promise.resolve();
    });
    tx.query.mockImplementation((sql: string) => {
      if (sql.includes('UPDATE outbox_events')) {
        ids.push(currentCorrelationId());
      }
      return Promise.resolve(
        sql.includes('SELECT id, envelope') ? [row('e1'), row('e2')] : [],
      );
    });
    await relay.relayBatch();
    expect(ids).toEqual(['corr-e1', 'corr-e1', 'corr-e2', 'corr-e2']);
    expect(currentCorrelationId()).toBeUndefined();
  });

  describe('failure logging', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('logs a failed publish under its correlation ID', async () => {
      const { relay, publisher } = setup();
      const ids: (string | undefined)[] = [];
      vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {
        ids.push(currentCorrelationId());
      });
      publisher.publish.mockRejectedValueOnce(new Error('nacked'));
      await relay.relayBatch();
      expect(ids).toEqual(['corr-e1']);
    });

    it('leaves a broker outage to the publisher, which logs it once', async () => {
      const { relay, publisher } = setup();
      const warn = vi
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => {});
      publisher.publish.mockRejectedValue(new BrokerUnavailableError());
      await expect(relay.relayBatch()).resolves.toBe(0);
      expect(warn).not.toHaveBeenCalled();
    });
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

describe('OutboxRelay pending gauge', () => {
  const recorder = recordMetrics();
  afterAll(() => recorder.stop());

  function relayWith(query: () => Promise<unknown>) {
    const db = {
      query: vi.fn((_sql: string) => query()),
      transaction: vi.fn(),
    };
    const relay = new OutboxRelay(
      db as unknown as DataSource,
      {} as unknown as EventPublisher,
    );
    relay.onApplicationBootstrap();
    return { db, relay };
  }

  it('reports the unsent rows at each collection', async () => {
    const { db, relay } = relayWith(() => Promise.resolve([{ pending: 7 }]));
    try {
      expect(await recorder.points(OUTBOX_PENDING_METRIC)).toEqual([
        { attributes: {}, value: 7 },
      ]);
      expect(db.query.mock.calls[0][0]).toContain('WHERE sent_at IS NULL');
    } finally {
      relay.onModuleDestroy();
    }
  });

  it('logs instead of failing the collection when the database fails', async () => {
    const warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => {});
    const { relay } = relayWith(() => Promise.reject(new Error('down')));
    try {
      await expect(recorder.points(OUTBOX_PENDING_METRIC)).resolves.toEqual(
        expect.any(Array),
      );
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('down'));
    } finally {
      relay.onModuleDestroy();
      vi.restoreAllMocks();
    }
  });

  it('stops reporting after shutdown', async () => {
    const { db, relay } = relayWith(() => Promise.resolve([{ pending: 1 }]));
    relay.onModuleDestroy();
    await recorder.points(OUTBOX_PENDING_METRIC);
    expect(db.query).not.toHaveBeenCalled();
  });
});
