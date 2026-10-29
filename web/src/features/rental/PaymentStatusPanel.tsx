import type { ReactNode } from 'react';
import { summarizePayments, type PaymentSummary } from '../../api/payment.ts';
import { Alert, Badge, formatBaht, Panel } from '../../ui/index.ts';
import { formatDateTime } from '../booking/dates.ts';
import { paymentLabel, paymentTone } from './status.ts';
import type { LoadedPayments } from './usePayments.ts';

// The booking's fee, deposit and payout from Payment (role D). A demo ledger: no real money.
export default function PaymentStatusPanel({
  loaded,
}: {
  loaded: LoadedPayments | null;
}) {
  return (
    <Panel title="Payment">
      <div className="stack">
        <PaymentBody loaded={loaded} />
        <p className="rental-note">Demo payments: no real money moves.</p>
      </div>
    </Panel>
  );
}

function PaymentBody({ loaded }: { loaded: LoadedPayments | null }) {
  if (!loaded) return <p>Loading payment status...</p>;
  if (!loaded.payments) return <Alert tone="danger">{loaded.error}</Alert>;
  const summary = summarizePayments(loaded.payments);
  if (!summary.fee && !summary.deposit) {
    return <p>Nothing was charged or held for this rental.</p>;
  }
  return (
    <dl className="rental-payments">
      {summary.fee && (
        <Line name="Rental fee" amount={summary.fee.amount}>
          <Badge tone={paymentTone(summary.fee.status)}>
            {paymentLabel(summary.fee.status)}
          </Badge>
        </Line>
      )}
      {summary.deposit && <DepositLine deposit={summary.deposit} />}
      <PayoutLine payout={summary.payout} />
    </dl>
  );
}

function Line({
  name,
  amount,
  children,
}: {
  name: string;
  amount: number;
  children?: ReactNode;
}) {
  return (
    <>
      <dt>{name}</dt>
      <dd className="rental-pay-line">
        <span>{formatBaht(amount)}</span>
        {children}
      </dd>
    </>
  );
}

function DepositLine({
  deposit,
}: {
  deposit: NonNullable<PaymentSummary['deposit']>;
}) {
  return (
    <>
      <Line name="Deposit" amount={deposit.amount}>
        <Badge tone={paymentTone(deposit.status)}>
          {paymentLabel(deposit.status)}
        </Badge>
      </Line>
      {deposit.charged > 0 && (
        <Line name="Late fee from deposit" amount={deposit.charged} />
      )}
      {deposit.released > 0 && (
        <Line name="Deposit released" amount={deposit.released} />
      )}
    </>
  );
}

function PayoutLine({ payout }: { payout: PaymentSummary['payout'] }) {
  if (!payout) {
    return (
      <>
        <dt>Paid to the owner</dt>
        <dd>After the return is settled</dd>
      </>
    );
  }
  return (
    <Line name="Paid to the owner" amount={payout.amount}>
      <span className="rental-note">on {formatDateTime(payout.paidAt)}</span>
    </Line>
  );
}
