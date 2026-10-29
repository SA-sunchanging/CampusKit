import type { ConsumeMessage } from 'amqplib';
import { handleDelivery, settle } from './delivery.js';

const VALID = {
  eventId: '11111111-1111-4111-8111-111111111111',
  type: 'listing.published',
  occurredAt: '2026-10-29T08:00:00.000Z',
  correlationId: 'corr-1',
  producer: 'listing',
  recipients: ['22222222-2222-4222-8222-222222222222'],
  data: { listingId: 'l-1' },
};

const body = (value: unknown): Buffer => Buffer.from(JSON.stringify(value));

describe('handleDelivery', () => {
  it('stores a valid envelope, then acks', async () => {
    const store = vi.fn(() => Promise.resolve());
    await expect(handleDelivery(body(VALID), store)).resolves.toBe('ack');
    expect(store).toHaveBeenCalledWith(VALID);
  });

  it('dead-letters a body that is not JSON', async () => {
    const store = vi.fn(() => Promise.resolve());
    await expect(handleDelivery(Buffer.from('{not json'), store)).resolves.toBe(
      'dead-letter',
    );
    expect(store).not.toHaveBeenCalled();
  });

  it('dead-letters an invalid envelope', async () => {
    const store = vi.fn(() => Promise.resolve());
    await expect(
      handleDelivery(body({ ...VALID, eventId: 'x' }), store),
    ).resolves.toBe('dead-letter');
    expect(store).not.toHaveBeenCalled();
  });

  it('requeues when the store fails', async () => {
    const store = vi.fn(() => Promise.reject(new Error('mongo down')));
    await expect(handleDelivery(body(VALID), store)).resolves.toBe('requeue');
  });
});

describe('settle', () => {
  const message = { content: Buffer.from('') } as ConsumeMessage;

  function fakeChannel() {
    return { ack: vi.fn(), nack: vi.fn() };
  }

  it('acks', () => {
    const channel = fakeChannel();
    settle(channel, message, 'ack');
    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('dead-letters with a nack that does not requeue', () => {
    const channel = fakeChannel();
    settle(channel, message, 'dead-letter');
    expect(channel.nack).toHaveBeenCalledWith(message, false, false);
  });

  it('requeues with a nack that requeues', () => {
    const channel = fakeChannel();
    settle(channel, message, 'requeue');
    expect(channel.nack).toHaveBeenCalledWith(message, false, true);
  });

  it('does not throw when the channel is already closed', () => {
    const channel = fakeChannel();
    channel.ack.mockImplementation(() => {
      throw new Error('Channel closed');
    });
    expect(() => settle(channel, message, 'ack')).not.toThrow();
  });
});
