import { rentalRow } from '../testing/fixtures.js';
import { isOverdue, lateCharge, lateDays, lateFeeSoFar } from './late-fee.js';

const end = new Date('2026-11-04T17:00:00.000Z');

describe('lateDays', () => {
  it.each([
    ['a day early', '2026-11-03T17:00:00.000Z', 0],
    ['exactly at the end', '2026-11-04T17:00:00.000Z', 0],
    ['one millisecond late', '2026-11-04T17:00:00.001Z', 1],
    ['exactly 24 hours late', '2026-11-05T17:00:00.000Z', 1],
    ['24 hours and a minute late', '2026-11-05T17:01:00.000Z', 2],
    ['three days late', '2026-11-07T17:00:00.000Z', 3],
  ])('counts %s as %i', (_label, returnedAt, days) => {
    expect(lateDays(end, new Date(returnedAt))).toBe(days);
  });
});

describe('lateCharge', () => {
  it('charges the late fee per day for each late day', () => {
    expect(
      lateCharge(rentalRow(), new Date('2026-11-05T18:00:00.000Z')),
    ).toEqual({ lateDays: 2, lateFee: 8000 });
  });

  it('charges nothing on time', () => {
    expect(lateCharge(rentalRow(), end)).toEqual({ lateDays: 0, lateFee: 0 });
  });

  it('caps the fee at what an integer column holds', () => {
    const row = rentalRow({ late_fee_per_day: 100_000_000 });
    expect(lateCharge(row, new Date('2026-12-04T17:00:00.000Z')).lateFee).toBe(
      2_147_483_647,
    );
  });
});

describe('isOverdue', () => {
  it('is true only for an ACTIVE rental the sweeper has flagged', () => {
    expect(isOverdue(rentalRow({ status: 'ACTIVE', overdue_at: end }))).toBe(
      true,
    );
    expect(isOverdue(rentalRow({ status: 'ACTIVE' }))).toBe(false);
    expect(
      isOverdue(rentalRow({ status: 'SETTLEMENT_PENDING', overdue_at: end })),
    ).toBe(false);
    expect(isOverdue(rentalRow({ status: 'CLOSED', overdue_at: end }))).toBe(
      false,
    );
  });
});

describe('lateFeeSoFar', () => {
  const overdue = rentalRow({ status: 'ACTIVE', overdue_at: end });

  it.each([
    ['exactly at the end', '2026-11-04T17:00:00.000Z', 0],
    ['one millisecond late', '2026-11-04T17:00:00.001Z', 4000],
    ['exactly 24 hours late', '2026-11-05T17:00:00.000Z', 4000],
    ['24 hours and a millisecond late', '2026-11-05T17:00:00.001Z', 8000],
  ])('charges %s as %i satang', (_label, now, fee) => {
    expect(lateFeeSoFar(overdue, new Date(now))).toBe(fee);
  });

  it('is 0 until the sweeper flags the rental overdue', () => {
    const now = new Date('2026-11-06T00:00:00.000Z');
    expect(lateFeeSoFar(rentalRow({ status: 'ACTIVE' }), now)).toBe(0);
  });

  it('is 0 once the rental is returned, whose late fee is stored', () => {
    const now = new Date('2026-11-06T00:00:00.000Z');
    const returned = rentalRow({
      status: 'SETTLEMENT_PENDING',
      overdue_at: end,
      late_fee: 8000,
    });
    expect(lateFeeSoFar(returned, now)).toBe(0);
  });

  it('is capped like the fee at the return', () => {
    const row = rentalRow({
      status: 'ACTIVE',
      overdue_at: end,
      late_fee_per_day: 100_000_000,
    });
    expect(lateFeeSoFar(row, new Date('2026-12-04T17:00:00.000Z'))).toBe(
      2_147_483_647,
    );
  });
});
