import { reminderLeadMs, sweepIntervalMs } from './sweep-config.js';

describe('sweepIntervalMs', () => {
  it('defaults to one minute', () => {
    expect(sweepIntervalMs(undefined)).toBe(60_000);
    expect(sweepIntervalMs(' ')).toBe(60_000);
  });

  it('reads a whole number of milliseconds', () => {
    expect(sweepIntervalMs('5000')).toBe(5000);
    expect(sweepIntervalMs(' 1000 ')).toBe(1000);
    expect(sweepIntervalMs('86400000')).toBe(86_400_000);
  });

  it.each(['999', '0', '-5000', '1.5', 'often', '1e4', '86400001'])(
    'falls back to one minute for %s',
    (value) => {
      expect(sweepIntervalMs(value)).toBe(60_000);
    },
  );
});

describe('reminderLeadMs', () => {
  it('defaults to one day', () => {
    expect(reminderLeadMs(undefined)).toBe(86_400_000);
    expect(reminderLeadMs('')).toBe(86_400_000);
  });

  it('reads a shorter lead for a demo', () => {
    expect(reminderLeadMs('120000')).toBe(120_000);
    expect(reminderLeadMs('2592000000')).toBe(2_592_000_000);
  });

  it.each(['0', '500', '-1', 'soon', '2592000001'])(
    'falls back to one day for %s',
    (value) => {
      expect(reminderLeadMs(value)).toBe(86_400_000);
    },
  );
});
