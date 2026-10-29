import { EventEmitter } from 'node:events';
import type { Channel, ChannelModel } from 'amqplib';
import {
  BrokerConnection,
  INITIAL_RETRY_DELAY_MS,
  MAX_RETRY_DELAY_MS,
} from './broker-connection.js';

class FakeChannel extends EventEmitter {}

class FakeConnection extends EventEmitter {
  readonly channel = new FakeChannel();
  readonly close = vi.fn(() => {
    this.emit('close');
    return Promise.resolve();
  });
  readonly createChannel = vi.fn(() => Promise.resolve(this.channel));
}

/**
 * A fake amqplib connect. Each call takes the next outcome: 'fail' rejects, 'ok' (the default
 * once the list is empty) resolves with a new FakeConnection.
 */
function setup(outcomes: ('ok' | 'fail')[] = []) {
  const connections: FakeConnection[] = [];
  const callTimes: number[] = [];
  const connect = vi.fn((_url: string) => {
    callTimes.push(Date.now());
    if (outcomes.shift() === 'fail') {
      return Promise.reject(new Error('ECONNREFUSED'));
    }
    const connection = new FakeConnection();
    connections.push(connection);
    return Promise.resolve(connection as unknown as ChannelModel);
  });
  const setupFn = vi.fn((_channel: Channel) => Promise.resolve());
  const broker = new BrokerConnection({
    url: 'amqp://test',
    connect,
    setup: setupFn,
  });
  const gaps = () => callTimes.slice(1).map((time, i) => time - callTimes[i]);
  return { broker, connect, setupFn, connections, gaps };
}

describe('BrokerConnection', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('connects in the background and runs setup on the channel', async () => {
    const { broker, connect, setupFn, connections } = setup();
    broker.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(connect).toHaveBeenCalledWith('amqp://test');
    expect(setupFn).toHaveBeenCalledWith(connections[0].channel);
  });

  it('keeps retrying while the broker is down at boot', async () => {
    const { broker, connect, setupFn } = setup(['fail', 'fail']);
    broker.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(connect).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(INITIAL_RETRY_DELAY_MS);
    expect(connect).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2 * INITIAL_RETRY_DELAY_MS);
    expect(connect).toHaveBeenCalledTimes(3);
    expect(setupFn).toHaveBeenCalledTimes(1);
  });

  it('doubles the delay up to 30 s', async () => {
    const { broker, gaps } = setup(Array<'fail'>(8).fill('fail'));
    broker.start();
    await vi.advanceTimersByTimeAsync(200_000);
    expect(gaps().slice(0, 8)).toEqual([
      1_000,
      2_000,
      4_000,
      8_000,
      16_000,
      MAX_RETRY_DELAY_MS,
      MAX_RETRY_DELAY_MS,
      MAX_RETRY_DELAY_MS,
    ]);
  });

  it('reconnects after the connection closes', async () => {
    const { broker, connect, setupFn, connections } = setup();
    broker.start();
    await vi.advanceTimersByTimeAsync(0);
    connections[0].emit('close', new Error('broker restarted'));
    await vi.advanceTimersByTimeAsync(INITIAL_RETRY_DELAY_MS);
    expect(connect).toHaveBeenCalledTimes(2);
    expect(setupFn).toHaveBeenLastCalledWith(connections[1].channel);
  });

  it('reconnects once when the connection errors and then closes', async () => {
    const { broker, connect, connections } = setup();
    broker.start();
    await vi.advanceTimersByTimeAsync(0);
    connections[0].emit('error', new Error('heartbeat timeout'));
    connections[0].emit('close');
    await vi.advanceTimersByTimeAsync(10 * INITIAL_RETRY_DELAY_MS);
    expect(connect).toHaveBeenCalledTimes(2);
  });

  it('reconnects after the channel closes', async () => {
    const { broker, connect, connections } = setup();
    broker.start();
    await vi.advanceTimersByTimeAsync(0);
    connections[0].channel.emit('close');
    expect(connections[0].close).toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(INITIAL_RETRY_DELAY_MS);
    expect(connect).toHaveBeenCalledTimes(2);
  });

  it('closes the connection and retries when setup fails', async () => {
    const { broker, connect, setupFn, connections } = setup();
    setupFn.mockRejectedValueOnce(new Error('PRECONDITION_FAILED'));
    broker.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(connections[0].close).toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(INITIAL_RETRY_DELAY_MS);
    expect(connect).toHaveBeenCalledTimes(2);
    expect(setupFn).toHaveBeenCalledTimes(2);
  });

  it('resets the delay after a successful connect', async () => {
    const { broker, connections, gaps } = setup(['fail', 'fail', 'fail']);
    broker.start();
    await vi.advanceTimersByTimeAsync(7_000);
    expect(gaps()).toEqual([1_000, 2_000, 4_000]);
    connections[0].emit('close');
    await vi.advanceTimersByTimeAsync(INITIAL_RETRY_DELAY_MS);
    expect(gaps()).toHaveLength(4);
    expect(connections).toHaveLength(2);
  });

  it('closes the connection and never reconnects after stop', async () => {
    const { broker, connect, connections } = setup();
    broker.start();
    await vi.advanceTimersByTimeAsync(0);
    await broker.stop();
    expect(connections[0].close).toHaveBeenCalled();
    connections[0].emit('close');
    await vi.advanceTimersByTimeAsync(10 * MAX_RETRY_DELAY_MS);
    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('cancels a pending retry on stop', async () => {
    const { broker, connect } = setup(['fail']);
    broker.start();
    await vi.advanceTimersByTimeAsync(0);
    await broker.stop();
    await vi.advanceTimersByTimeAsync(10 * MAX_RETRY_DELAY_MS);
    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('closes a connection that opens after stop', async () => {
    const { broker, connections, setupFn } = setup();
    broker.start();
    await broker.stop();
    await vi.advanceTimersByTimeAsync(0);
    expect(connections[0].close).toHaveBeenCalled();
    expect(setupFn).not.toHaveBeenCalled();
  });
});
