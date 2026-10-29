import type { ConsumeMessage } from 'amqplib';
import { describeDeadLetter, MAX_CONTENT_LENGTH } from './dead-letter.js';

const RECEIVED_AT = new Date('2026-10-29T09:00:00.000Z');
/** 2026-10-29T08:00:00Z in seconds, as an AMQP timestamp. */
const DEAD_AT = 1_793_260_800;

const xDeath = (overrides: Record<string, unknown> = {}) => [
  {
    count: 1,
    reason: 'rejected',
    queue: 'notification.inbox',
    time: { '!': 'timestamp', value: DEAD_AT },
    exchange: 'campuskit.events',
    'routing-keys': ['booking.requested'],
    ...overrides,
  },
];

function message(
  content: string,
  headers: Record<string, unknown> = { 'x-death': xDeath() },
) {
  return {
    content: Buffer.from(content),
    fields: { routingKey: 'booking.requested' },
    properties: { headers },
  } as unknown as ConsumeMessage;
}

describe('describeDeadLetter', () => {
  it('keeps the envelope fields of a JSON body that failed validation', () => {
    const body = JSON.stringify({
      eventId: 'not-a-uuid',
      type: 'booking.requested',
      correlationId: 'corr-1',
    });
    expect(describeDeadLetter(message(body), RECEIVED_AT)).toMatchObject({
      content: body,
      size: Buffer.byteLength(body),
      routingKey: 'booking.requested',
      eventId: 'not-a-uuid',
      type: 'booking.requested',
      correlationId: 'corr-1',
      reason: 'rejected',
      queue: 'notification.inbox',
      count: 1,
      deadLetteredAt: new Date('2026-10-29T08:00:00.000Z'),
      receivedAt: RECEIVED_AT,
    });
  });

  it.each([
    ['not JSON', '{not json'],
    ['JSON null', 'null'],
    ['a JSON string', '"text"'],
  ])('keeps a body that is %s without envelope fields', (_case, body) => {
    const letter = describeDeadLetter(message(body), RECEIVED_AT);
    expect(letter.content).toBe(body);
    expect(letter.eventId).toBeUndefined();
    expect(letter.type).toBeUndefined();
    expect(letter.correlationId).toBeUndefined();
  });

  it('drops envelope fields that are not short text', () => {
    const body = JSON.stringify({ eventId: 42, type: 'x'.repeat(257) });
    const letter = describeDeadLetter(message(body));
    expect(letter.eventId).toBeUndefined();
    expect(letter.type).toBeUndefined();
  });

  it('cuts a long body but keeps its full size', () => {
    const body = 'x'.repeat(MAX_CONTENT_LENGTH + 10);
    const letter = describeDeadLetter(message(body));
    expect(letter.content).toHaveLength(MAX_CONTENT_LENGTH);
    expect(letter.size).toBe(MAX_CONTENT_LENGTH + 10);
  });

  it('copes with a message without x-death', () => {
    const letter = describeDeadLetter(message('{}', {}));
    expect(letter).toMatchObject({
      reason: undefined,
      queue: undefined,
      count: undefined,
      deadLetteredAt: undefined,
    });
    expect(letter.key).toMatch(/^[0-9a-f]{64}$/);
  });

  describe('key', () => {
    it('is the same for a redelivery of the same dead letter', () => {
      const first = describeDeadLetter(message('{not json'));
      const again = describeDeadLetter(
        message('{not json', { 'x-death': xDeath({ count: 2 }) }),
      );
      expect(again.key).toBe(first.key);
    });

    it('differs for the same body dead-lettered at another time', () => {
      const first = describeDeadLetter(message('{not json'));
      const later = describeDeadLetter(
        message('{not json', {
          'x-death': xDeath({ time: { '!': 'timestamp', value: DEAD_AT + 1 } }),
        }),
      );
      expect(later.key).not.toBe(first.key);
    });

    it('differs for another body', () => {
      expect(describeDeadLetter(message('a')).key).not.toBe(
        describeDeadLetter(message('b')).key,
      );
    });
  });
});
