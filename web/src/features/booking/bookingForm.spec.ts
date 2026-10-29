import { describe, expect, it } from 'vitest';
import {
  dayLimits,
  estimate,
  rentalDays,
  toBookingPeriod,
  validateBookingDays,
} from './bookingForm.ts';

// 12:00 on 29 Oct 2026 in Bangkok.
const NOW = new Date('2026-10-29T05:00:00Z');
const days = (pickupDay: string, returnDay: string) => ({
  pickupDay,
  returnDay,
});

describe('toBookingPeriod', () => {
  it('runs from 00:00 Bangkok on the pickup day to 00:00 on the return day', () => {
    expect(toBookingPeriod(days('2026-11-01', '2026-11-04'))).toEqual({
      start: '2026-10-31T17:00:00.000Z',
      end: '2026-11-03T17:00:00.000Z',
    });
  });

  it.each([
    ['', '2026-11-04'],
    ['2026-11-01', ''],
    ['2026-11-01', '2026-11-01'],
    ['2026-11-04', '2026-11-01'],
    ['2026-02-30', '2026-03-02'],
  ])('is null for %j to %j', (pickupDay, returnDay) => {
    expect(toBookingPeriod(days(pickupDay, returnDay))).toBeNull();
  });
});

describe('rentalDays', () => {
  it('counts the return day minus the pickup day', () => {
    const period = toBookingPeriod(days('2026-12-30', '2027-01-02'));
    expect(period && rentalDays(period)).toBe(3);
  });
});

describe('validateBookingDays', () => {
  it('accepts pickup tomorrow for one day', () => {
    expect(
      validateBookingDays(days('2026-10-30', '2026-10-31'), 7, NOW),
    ).toEqual({});
  });

  it('accepts the longest rental the listing allows', () => {
    expect(
      validateBookingDays(days('2026-11-01', '2026-11-08'), 7, NOW),
    ).toEqual({});
  });

  it('asks for both days', () => {
    expect(validateBookingDays(days('', ''), 7, NOW)).toEqual({
      pickupDay: 'Choose a pickup day.',
      returnDay: 'Choose a return day.',
    });
  });

  it('rejects pickup today or earlier', () => {
    expect(
      validateBookingDays(days('2026-10-29', '2026-10-31'), 7, NOW).pickupDay,
    ).toBe('The earliest pickup day is tomorrow.');
  });

  it('rejects a return day that is not after pickup', () => {
    expect(
      validateBookingDays(days('2026-11-02', '2026-11-02'), 7, NOW).returnDay,
    ).toBe('The return day must be after the pickup day.');
  });

  it('rejects more days than the listing allows', () => {
    expect(
      validateBookingDays(days('2026-11-01', '2026-11-09'), 7, NOW).returnDay,
    ).toBe('This item can be rented for at most 7 days.');
    expect(
      validateBookingDays(days('2026-11-01', '2026-11-03'), 1, NOW).returnDay,
    ).toBe('This item can be rented for at most 1 day.');
  });

  it('accepts a return day 366 days ahead and rejects the day after', () => {
    expect(
      validateBookingDays(days('2027-10-29', '2027-10-30'), 7, NOW),
    ).toEqual({});
    expect(
      validateBookingDays(days('2027-10-30', '2027-10-31'), 7, NOW).returnDay,
    ).toBe('The return day must be within one year from today.');
  });

  it('rejects dates that do not exist', () => {
    expect(
      validateBookingDays(days('2026-11-31', '2026-12-02'), 7, NOW),
    ).toEqual({ pickupDay: 'Enter a valid date.' });
  });
});

describe('dayLimits', () => {
  it('starts tomorrow and ends one year ahead before a pickup is chosen', () => {
    expect(dayLimits('', 7, NOW)).toEqual({
      minPickup: '2026-10-30',
      maxPickup: '2027-10-29',
      minReturn: '2026-10-31',
      maxReturn: '2026-11-06',
    });
  });

  it('follows the chosen pickup day', () => {
    expect(dayLimits('2026-11-01', 7, NOW)).toMatchObject({
      minReturn: '2026-11-02',
      maxReturn: '2026-11-08',
    });
  });

  it('never goes past one year', () => {
    expect(dayLimits('2027-10-28', 7, NOW).maxReturn).toBe('2027-10-30');
  });
});

describe('estimate', () => {
  it('multiplies the daily rate by the days', () => {
    const period = toBookingPeriod(days('2026-11-01', '2026-11-04'));
    if (!period) throw new Error('invalid period');
    expect(
      estimate(period, {
        dailyRate: 2000,
        deposit: 30000,
        lateFeePerDay: 4000,
      }),
    ).toEqual({
      days: 3,
      rentalFee: 6000,
      deposit: 30000,
      lateFeePerDay: 4000,
    });
  });
});
