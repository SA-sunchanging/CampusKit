import { describe, expect, it } from 'vitest';
import {
  type Authorization,
  type PaymentStatus,
  summarizePayments,
} from './payment.ts';

const EXPIRES = '2026-11-28T05:00:00.000Z';

function hold(overrides: Partial<Authorization>): Authorization {
  return {
    id: 'a1',
    kind: 'FEE',
    amount: 6000,
    capturedAmount: 0,
    releasedAmount: 0,
    status: 'AUTHORIZED',
    expiresAt: EXPIRES,
    ...overrides,
  };
}

function status(
  authorizations: Authorization[],
  payout: PaymentStatus['payout'] = null,
): PaymentStatus {
  return { bookingId: 'b1', authorizations, payout };
}

describe('summarizePayments', () => {
  it('has no lines when nothing is authorized', () => {
    expect(summarizePayments(status([]))).toEqual({
      fee: null,
      deposit: null,
      payout: null,
    });
  });

  it('shows both holds before pickup', () => {
    const summary = summarizePayments(
      status([hold({}), hold({ id: 'a2', kind: 'DEPOSIT', amount: 30000 })]),
    );
    expect(summary.fee).toEqual({
      amount: 6000,
      status: 'AUTHORIZED',
      charged: 0,
    });
    expect(summary.deposit).toEqual({
      amount: 30000,
      status: 'AUTHORIZED',
      held: 30000,
      released: 0,
      charged: 0,
    });
  });

  it('shows the captured fee after pickup', () => {
    const summary = summarizePayments(
      status([hold({ status: 'CAPTURED', capturedAmount: 6000 })]),
    );
    expect(summary.fee).toEqual({
      amount: 6000,
      status: 'CAPTURED',
      charged: 6000,
    });
    expect(summary.deposit).toBeNull();
  });

  it('splits a settled deposit into late fee and release, with the payout', () => {
    const payout = { amount: 14000, payeeId: 'o1', paidAt: EXPIRES };
    const summary = summarizePayments(
      status(
        [
          hold({ status: 'CAPTURED', capturedAmount: 6000 }),
          hold({
            id: 'a2',
            kind: 'DEPOSIT',
            amount: 30000,
            capturedAmount: 8000,
            releasedAmount: 22000,
            status: 'SETTLED',
          }),
        ],
        payout,
      ),
    );
    expect(summary.deposit).toEqual({
      amount: 30000,
      status: 'SETTLED',
      held: 0,
      released: 22000,
      charged: 8000,
    });
    expect(summary.payout).toEqual(payout);
  });

  it('still counts an expired hold as held, and a voided one as released', () => {
    const expired = summarizePayments(
      status([hold({ kind: 'DEPOSIT', amount: 500, status: 'EXPIRED' })]),
    );
    expect(expired.deposit?.held).toBe(500);
    const voided = summarizePayments(
      status([
        hold({
          kind: 'DEPOSIT',
          amount: 500,
          releasedAmount: 500,
          status: 'VOIDED',
        }),
      ]),
    );
    expect(voided.deposit).toMatchObject({ held: 0, released: 500 });
  });
});
