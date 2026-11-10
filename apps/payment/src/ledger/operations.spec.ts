import { ConflictException } from '@nestjs/common';
import { BOOKING_ID, errorOf, fakeLedger } from '../testing/fake-ledger.js';
import { canonicalJson, requestHash, runOperation } from './operations.js';

const request = { operationId: 'op-1', bookingId: BOOKING_ID, amount: 6000 };

describe('canonicalJson', () => {
  it('sorts keys at every level and drops undefined fields', () => {
    expect(
      canonicalJson({ b: 1, a: { d: [2, { f: 1, e: 0 }], c: undefined } }),
    ).toBe('{"a":{"d":[2,{"e":0,"f":1}]},"b":1}');
  });
});

describe('requestHash', () => {
  it('is the same whatever the key order', () => {
    expect(requestHash('CAPTURE', { a: 1, b: 2 })).toBe(
      requestHash('CAPTURE', { b: 2, a: 1 }),
    );
  });

  it('differs by operation and by body', () => {
    const hash = requestHash('CAPTURE', request);
    expect(requestHash('VOID', request)).not.toBe(hash);
    expect(requestHash('CAPTURE', { ...request, amount: 1 })).not.toBe(hash);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('runOperation', () => {
  it('locks the booking before the operation ID, applies the change and stores the result', async () => {
    const { db, state } = fakeLedger();
    const apply = vi.fn().mockResolvedValue({ done: true });
    await expect(runOperation(db, 'CAPTURE', request, apply)).resolves.toEqual({
      done: true,
    });
    expect(state.queries[0]).toEqual({
      sql: 'SELECT pg_advisory_xact_lock(hashtext($1))',
      params: [`payment:booking:${BOOKING_ID}`],
    });
    expect(state.queries[1].params).toEqual(['payment:operation:op-1']);
    expect(state.queries[3].sql).toContain('FOR UPDATE');
    expect(state.entries.get('op-1')).toEqual({
      operation: 'CAPTURE',
      booking_id: BOOKING_ID,
      request_hash: requestHash('CAPTURE', request),
      result: { done: true },
    });
  });

  it('uses one booking lock for UUIDs with different letter case', async () => {
    const { db, state } = fakeLedger();
    const bookingId = 'ABCDEFAB-ABCD-4ABC-8ABC-ABCDEFABCDEF';
    await runOperation(db, 'VOID', { ...request, bookingId }, () =>
      Promise.resolve({}),
    );
    expect(state.queries[0].params).toEqual([
      `payment:booking:${bookingId.toLowerCase()}`,
    ]);
  });

  it('returns the stored result for a repeated request without applying it again', async () => {
    const { db, state } = fakeLedger();
    await runOperation(db, 'CAPTURE', request, () => Promise.resolve({ n: 1 }));
    const apply = vi.fn();
    await expect(
      runOperation(
        db,
        'CAPTURE',
        { amount: 6000, bookingId: BOOKING_ID, operationId: 'op-1' },
        apply,
      ),
    ).resolves.toEqual({ n: 1 });
    expect(apply).not.toHaveBeenCalled();
    expect(state.entries.size).toBe(1);
  });

  it('answers 409 when the operation ID was used for a different request', async () => {
    const { db } = fakeLedger();
    await runOperation(db, 'CAPTURE', request, () => Promise.resolve({}));
    const apply = vi.fn();
    const err = await errorOf(
      runOperation(db, 'CAPTURE', { ...request, amount: 1 }, apply),
    );
    expect(err).toBeInstanceOf(ConflictException);
    expect((err as Error).message).toBe(
      'operationId was already used for a different request',
    );
    await expect(
      runOperation(db, 'VOID', request, () => Promise.resolve({})),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(apply).not.toHaveBeenCalled();
  });

  it('stores nothing when the change is refused, so a retry can succeed', async () => {
    const { db, state } = fakeLedger();
    await expect(
      runOperation(db, 'CAPTURE', request, () =>
        Promise.reject(new ConflictException('no')),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(state.entries.size).toBe(0);
    await expect(
      runOperation(db, 'CAPTURE', request, () => Promise.resolve({ ok: 1 })),
    ).resolves.toEqual({ ok: 1 });
  });

  it("passes the booking's locked authorizations to the change", async () => {
    const { db } = fakeLedger();
    const apply = vi.fn().mockResolvedValue({});
    await runOperation(db, 'VOID', request, apply);
    expect(apply).toHaveBeenCalledWith(expect.anything(), []);
  });
});
