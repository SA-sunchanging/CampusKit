import { describe, expect, it } from 'vitest';
import { AUTHORIZATION_STATUSES } from '../../api/payment.ts';
import { RENTAL_STATUSES, type RentalStatus } from '../../api/rental.ts';
import {
  nextAction,
  nextStepNote,
  PAYMENT_LABELS,
  PAYMENT_TONES,
  paymentLabel,
  paymentTone,
  STATUS_LABELS,
  STATUS_TONES,
  statusLabel,
  statusTone,
} from './status.ts';

const OWNER = '11111111-1111-4111-8111-111111111111';
const RENTER = '22222222-2222-4222-8222-222222222222';
const OTHER = '33333333-3333-4333-8333-333333333333';
// The period is 1 Nov 00:00 - 2 Nov 00:00 Bangkok; pickup opens 31 Oct 00:00 Bangkok.
const period = {
  start: '2026-10-31T17:00:00.000Z',
  end: '2026-11-01T17:00:00.000Z',
};
const rental = (status: RentalStatus) => ({
  status,
  ownerId: OWNER,
  renterId: RENTER,
  period,
});
const at = (iso: string) => new Date(iso);
const INSIDE = at('2026-10-31T05:00:00Z');

describe('status labels', () => {
  it('has a label and a tone for every status', () => {
    for (const status of RENTAL_STATUSES) {
      expect(STATUS_LABELS[status]).toBeTruthy();
      expect(STATUS_TONES[status]).toBeTruthy();
    }
  });

  it('shows an active rental as success and a closed one as neutral', () => {
    expect(statusTone('ACTIVE')).toBe('success');
    expect(statusTone('CLOSED')).toBe('neutral');
    expect(statusLabel('AWAITING_PICKUP')).toBe('Waiting for pickup');
  });

  it('shows an unknown status as its code in neutral', () => {
    expect(statusLabel('DISPUTED')).toBe('DISPUTED');
    expect(statusTone('DISPUTED')).toBe('neutral');
    expect(statusLabel('toString')).toBe('toString');
  });
});

describe('payment labels', () => {
  it('has a label and a tone for every hold status', () => {
    for (const status of AUTHORIZATION_STATUSES) {
      expect(PAYMENT_LABELS[status]).toBeTruthy();
      expect(PAYMENT_TONES[status]).toBeTruthy();
    }
  });

  it('shows a captured fee as paid and an expired hold as danger', () => {
    expect(paymentLabel('CAPTURED')).toBe('Paid');
    expect(paymentTone('EXPIRED')).toBe('danger');
  });

  it('shows an unknown status as its code in neutral', () => {
    expect(paymentLabel('REFUNDED')).toBe('REFUNDED');
    expect(paymentTone('REFUNDED')).toBe('neutral');
    expect(paymentLabel('toString')).toBe('toString');
  });
});

describe('nextAction for the owner', () => {
  it.each([
    ['AWAITING_PICKUP', 'show-pickup-code'],
    ['ACTIVE', 'enter-return-code'],
    ['SETTLEMENT_PENDING', 'retry-settlement'],
    ['CLOSED', 'none'],
    ['CANCELLED', 'none'],
  ] as const)('on %s is %s', (status, action) => {
    expect(nextAction(rental(status), OWNER, INSIDE)).toBe(action);
  });

  it('ignores the case of the user ID', () => {
    expect(nextAction(rental('ACTIVE'), OWNER.toUpperCase(), INSIDE)).toBe(
      'enter-return-code',
    );
  });
});

describe('nextAction for the renter', () => {
  it('waits until 24 hours before the period starts', () => {
    expect(
      nextAction(rental('AWAITING_PICKUP'), RENTER, at('2026-10-30T16:59:59Z')),
    ).toBe('wait-for-pickup-window');
  });

  it('enters the pickup code from 24 hours before the start until the end', () => {
    for (const time of ['2026-10-30T17:00:00Z', '2026-11-01T16:59:59Z']) {
      expect(nextAction(rental('AWAITING_PICKUP'), RENTER, at(time))).toBe(
        'enter-pickup-code',
      );
    }
  });

  it('has nothing to do once the period has ended', () => {
    expect(
      nextAction(rental('AWAITING_PICKUP'), RENTER, at('2026-11-01T17:00:00Z')),
    ).toBe('none');
  });

  it.each([
    ['ACTIVE', 'show-return-code'],
    ['SETTLEMENT_PENDING', 'none'],
    ['CLOSED', 'none'],
    ['CANCELLED', 'none'],
  ] as const)('on %s is %s', (status, action) => {
    expect(nextAction(rental(status), RENTER, INSIDE)).toBe(action);
  });
});

describe('nextAction for anyone else', () => {
  it('is none', () => {
    expect(nextAction(rental('AWAITING_PICKUP'), OTHER, INSIDE)).toBe('none');
  });
});

describe('nextStepNote', () => {
  it('tells the renter when pickup opens, in Bangkok time', () => {
    expect(
      nextStepNote(
        rental('AWAITING_PICKUP'),
        RENTER,
        at('2026-10-29T05:00:00Z'),
      ),
    ).toBe('Pickup opens on 31 Oct 2026, 00:00.');
  });

  it('tells the owner to give the pickup code', () => {
    expect(nextStepNote(rental('AWAITING_PICKUP'), OWNER, INSIDE)).toMatch(
      /pickup code/,
    );
  });

  it('describes a pending settlement to the renter and a closed rental to both', () => {
    expect(nextStepNote(rental('SETTLEMENT_PENDING'), RENTER, INSIDE)).toMatch(
      /being settled/,
    );
    expect(nextStepNote(rental('CLOSED'), OWNER, INSIDE)).toBe(
      'Returned and settled.',
    );
  });

  it('tells the renter that the pickup period has ended', () => {
    expect(
      nextStepNote(
        rental('AWAITING_PICKUP'),
        RENTER,
        at('2026-11-02T00:00:00Z'),
      ),
    ).toMatch(/can no longer be picked up/);
  });

  it('says nothing to someone else', () => {
    expect(nextStepNote(rental('ACTIVE'), OTHER, INSIDE)).toBeNull();
  });
});
