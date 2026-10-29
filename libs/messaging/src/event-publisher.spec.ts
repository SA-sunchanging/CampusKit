import { EventEmitter } from 'node:events';
import { Logger } from '@nestjs/common';
import type { EventEnvelope } from '@app/contracts';
import { connect } from 'amqplib';
import {
  BrokerUnavailableError,
  EventPublisher,
  INITIAL_RECONNECT_DELAY_MS,
  MAX_RECONNECT_DELAY_MS,
} from './event-publisher.js';

vi.mock('amqplib', () => ({ connect: vi.fn() }));

const connectMock = vi.mocked(connect);

const event = {
  eventId: '11111111-1111-4111-8111-111111111111',
  type: 'booking.requested',
} as EventEnvelope;

/** A broker connection stand-in: an emitter with a confirm channel that is also an emitter. */
function fakeConnection() {
  const channel = Object.assign(new EventEmitter(), {
    assertExchange: vi.fn(() => Promise.resolve()),
    publish: vi.fn(() => true),
    waitForConfirms: vi.fn(() => Promise.resolve()),
  });
  const connection = Object.assign(new EventEmitter(), {
    createConfirmChannel: vi.fn(() => Promise.resolve(channel)),
    close: vi.fn(() => Promise.resolve()),
  });
  return { connection, channel };
}

function brokerUp() {
  const fake = fakeConnection();
  connectMock.mockResolvedValueOnce(fake.connection as never);
  return fake;
}

function brokerDown(times = 1) {
  for (let i = 0; i < times; i++) {
    connectMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));
  }
}

let warn: ReturnType<typeof vi.spyOn>;
let log: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.useFakeTimers();
  connectMock.mockReset();
  warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('EventPublisher', () => {
  it('connects once and publishes each event with its type as routing key', async () => {
    const { channel } = brokerUp();
    const publisher = new EventPublisher();
    await publisher.publish(event);
    await publisher.publish(event);
    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(channel.publish).toHaveBeenCalledWith(
      'campuskit.events',
      'booking.requested',
      expect.any(Buffer),
      expect.objectContaining({ persistent: true, messageId: event.eventId }),
    );
    expect(channel.waitForConfirms).toHaveBeenCalledTimes(2);
  });

  it('fails at once while it waits to reconnect, then reconnects', async () => {
    brokerDown();
    const publisher = new EventPublisher();
    await expect(publisher.publish(event)).rejects.toBeInstanceOf(
      BrokerUnavailableError,
    );
    await expect(publisher.publish(event)).rejects.toBeInstanceOf(
      BrokerUnavailableError,
    );
    expect(connectMock).toHaveBeenCalledTimes(1);
    const { channel } = brokerUp();
    await vi.advanceTimersByTimeAsync(INITIAL_RECONNECT_DELAY_MS);
    expect(connectMock).toHaveBeenCalledTimes(2);
    await publisher.publish(event);
    expect(channel.publish).toHaveBeenCalledTimes(1);
  });

  it('doubles the delay after each failed attempt up to 30 s', async () => {
    brokerDown(8);
    const publisher = new EventPublisher();
    await expect(publisher.publish(event)).rejects.toThrow();
    const delays = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000];
    for (const [index, delay] of delays.entries()) {
      await vi.advanceTimersByTimeAsync(delay - 1);
      expect(connectMock).toHaveBeenCalledTimes(index + 1);
      await vi.advanceTimersByTimeAsync(1);
      expect(connectMock).toHaveBeenCalledTimes(index + 2);
    }
    expect(delays.at(-1)).toBe(MAX_RECONNECT_DELAY_MS);
    await publisher.onModuleDestroy();
  });

  it('logs an outage once when it starts and once when the broker is back', async () => {
    brokerDown(3);
    const publisher = new EventPublisher();
    await expect(publisher.publish(event)).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(1_000 + 2_000);
    brokerUp();
    await vi.advanceTimersByTimeAsync(4_000);
    expect(connectMock).toHaveBeenCalledTimes(4);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0][0])).toContain('back');
  });

  it('reconnects with the first delay after an established connection is lost', async () => {
    const first = brokerUp();
    const publisher = new EventPublisher();
    await publisher.publish(event);
    first.connection.emit('error', new Error('connection reset'));
    first.connection.emit('close');
    first.channel.emit('close');
    expect(warn).toHaveBeenCalledTimes(1);
    await expect(publisher.publish(event)).rejects.toBeInstanceOf(
      BrokerUnavailableError,
    );
    const second = brokerUp();
    await vi.advanceTimersByTimeAsync(INITIAL_RECONNECT_DELAY_MS);
    await publisher.publish(event);
    expect(second.channel.publish).toHaveBeenCalledTimes(1);
    expect(connectMock).toHaveBeenCalledTimes(2);
  });

  it('treats a closed channel as a lost connection', async () => {
    const first = brokerUp();
    const publisher = new EventPublisher();
    await publisher.publish(event);
    first.channel.emit('error', new Error('PRECONDITION_FAILED'));
    expect(first.connection.close).toHaveBeenCalled();
    await expect(publisher.publish(event)).rejects.toBeInstanceOf(
      BrokerUnavailableError,
    );
  });

  it('stops reconnecting after destroy', async () => {
    brokerDown();
    const publisher = new EventPublisher();
    await expect(publisher.publish(event)).rejects.toThrow();
    await publisher.onModuleDestroy();
    await vi.advanceTimersByTimeAsync(MAX_RECONNECT_DELAY_MS);
    expect(connectMock).toHaveBeenCalledTimes(1);
    await expect(publisher.publish(event)).rejects.toBeInstanceOf(
      BrokerUnavailableError,
    );
  });
});
