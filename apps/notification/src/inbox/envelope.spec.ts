import { parseEnvelope } from './envelope.js';

const EVENT_ID = '11111111-1111-4111-8111-111111111111';
const OWNER_ID = '22222222-2222-4222-8222-222222222222';
const RENTER_ID = '33333333-3333-4333-8333-333333333333';

function envelope(overrides: Record<string, unknown> = {}) {
  return {
    eventId: EVENT_ID,
    type: 'booking.confirmed',
    occurredAt: '2026-10-29T08:00:00.000Z',
    correlationId: 'corr-1',
    producer: 'booking',
    recipients: [OWNER_ID, RENTER_ID],
    data: { bookingId: 'b-1', status: 'CONFIRMED' },
    ...overrides,
  };
}

describe('parseEnvelope', () => {
  it('accepts a complete envelope', () => {
    expect(parseEnvelope(envelope())).toEqual(envelope());
  });

  it('drops fields outside the contract', () => {
    expect(parseEnvelope(envelope({ extra: 1 }))).toEqual(envelope());
  });

  it('accepts an empty recipient list', () => {
    expect(parseEnvelope(envelope({ recipients: [] }))).toMatchObject({
      recipients: [],
    });
  });

  it('accepts an empty data object', () => {
    expect(parseEnvelope(envelope({ data: {} }))).toMatchObject({ data: {} });
  });

  it.each([null, 'text', 42, [], undefined])(
    'rejects a message that is not an object (%s)',
    (raw) => {
      expect(parseEnvelope(raw)).toBeUndefined();
    },
  );

  it.each([
    ['eventId', undefined],
    ['eventId', 'not-a-uuid'],
    ['eventId', 42],
    ['type', ''],
    ['type', '   '],
    ['type', undefined],
    ['occurredAt', 'yesterday'],
    ['occurredAt', '2026-13-45T00:00:00Z'],
    ['occurredAt', ''],
    ['occurredAt', 1793310000000],
    ['correlationId', ''],
    ['correlationId', undefined],
    ['producer', ''],
    ['producer', null],
    ['recipients', undefined],
    ['recipients', OWNER_ID],
    ['recipients', [OWNER_ID, 'nobody']],
    ['recipients', [OWNER_ID, 7]],
    ['data', undefined],
    ['data', null],
    ['data', 'text'],
    ['data', [1, 2]],
  ])('rejects %s = %j', (field, value) => {
    expect(parseEnvelope(envelope({ [field]: value }))).toBeUndefined();
  });

  it('rejects an envelope that lacks a field', () => {
    const { producer: _producer, ...rest } = envelope();
    expect(parseEnvelope(rest)).toBeUndefined();
  });

  it('rejects data that is not a plain object', () => {
    expect(parseEnvelope(envelope({ data: new Date() }))).toBeUndefined();
  });
});
