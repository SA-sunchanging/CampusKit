import { status } from '@grpc/grpc-js';
import type { RpcException } from '@nestjs/microservices';
import {
  checkOpenRequests,
  checkRequestPeriod,
  expiresAt,
  parseRole,
  parseStatusFilter,
} from './booking-rules.js';

const now = new Date('2026-10-29T05:00:00Z');
const day = (date: string) => new Date(`${date}T17:00:00Z`);

function codeOf(fn: () => unknown): number | undefined {
  try {
    fn();
  } catch (err) {
    return ((err as RpcException).getError() as { code: number }).code;
  }
  return undefined;
}

describe('checkRequestPeriod', () => {
  it('accepts a period starting tomorrow in Bangkok', () => {
    expect(
      codeOf(() =>
        checkRequestPeriod(
          { start: day('2026-10-29'), end: day('2026-10-30') },
          now,
        ),
      ),
    ).toBeUndefined();
  });

  it('rejects a period that has already started', () => {
    expect(
      codeOf(() =>
        checkRequestPeriod(
          { start: day('2026-10-28'), end: day('2026-10-30') },
          now,
        ),
      ),
    ).toBe(status.INVALID_ARGUMENT);
  });

  it('rejects a period starting exactly now', () => {
    const start = day('2026-10-29');
    expect(
      codeOf(() =>
        checkRequestPeriod({ start, end: day('2026-10-30') }, start),
      ),
    ).toBe(status.INVALID_ARGUMENT);
  });

  it('accepts an end exactly 366 days ahead and rejects one day more', () => {
    const at = day('2026-10-28');
    const start = day('2027-10-28');
    expect(
      codeOf(() => checkRequestPeriod({ start, end: day('2027-10-29') }, at)),
    ).toBeUndefined();
    expect(
      codeOf(() => checkRequestPeriod({ start, end: day('2027-10-30') }, at)),
    ).toBe(status.INVALID_ARGUMENT);
  });

  it('rejects times that are not midnight in Bangkok', () => {
    expect(
      codeOf(() =>
        checkRequestPeriod(
          {
            start: new Date('2026-11-01T00:00:00Z'),
            end: day('2026-11-02'),
          },
          now,
        ),
      ),
    ).toBe(status.INVALID_ARGUMENT);
  });
});

describe('expiresAt', () => {
  it('gives the owner 24 hours', () => {
    expect(expiresAt(now, day('2026-11-10')).toISOString()).toBe(
      '2026-10-30T05:00:00.000Z',
    );
  });

  it('expires when the period starts if that is sooner', () => {
    expect(expiresAt(now, day('2026-10-29')).toISOString()).toBe(
      '2026-10-29T17:00:00.000Z',
    );
  });
});

describe('checkOpenRequests', () => {
  it('allows a fifth open request', () => {
    expect(codeOf(() => checkOpenRequests(4))).toBeUndefined();
  });

  it('refuses a sixth open request', () => {
    expect(codeOf(() => checkOpenRequests(5))).toBe(status.FAILED_PRECONDITION);
  });
});

describe('parseRole', () => {
  it('accepts renter and owner', () => {
    expect(parseRole('renter')).toBe('renter');
    expect(parseRole('owner')).toBe('owner');
  });

  it('rejects anything else, including an empty role', () => {
    expect(codeOf(() => parseRole(''))).toBe(status.INVALID_ARGUMENT);
    expect(codeOf(() => parseRole('admin'))).toBe(status.INVALID_ARGUMENT);
  });
});

describe('parseStatusFilter', () => {
  it('treats an empty status as no filter', () => {
    expect(parseStatusFilter('')).toBeNull();
    expect(parseStatusFilter(undefined)).toBeNull();
  });

  it('accepts a known status and rejects an unknown one', () => {
    expect(parseStatusFilter('CONFIRMED')).toBe('CONFIRMED');
    expect(codeOf(() => parseStatusFilter('pending'))).toBe(
      status.INVALID_ARGUMENT,
    );
  });
});
