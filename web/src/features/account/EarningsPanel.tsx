import { useEffect, useState } from 'react';
import { getMyEarnings, type EarningsSummary } from '../../api/payment.ts';
import { Alert, formatBaht, Panel } from '../../ui/index.ts';

export default function EarningsPanel() {
  const [earnings, setEarnings] = useState<EarningsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getMyEarnings()
      .then((summary) => active && setEarnings(summary))
      .catch((err: Error) => active && setError(err.message));
    return () => {
      active = false;
    };
  }, []);

  return (
    <Panel title="Earnings">
      <div className="stack">
        <p>
          Your all-time earnings from settled rentals, including charged late
          fees. Held deposits and unfinished bookings are excluded.
        </p>
        {error && <Alert tone="danger">{error}</Alert>}
        {!earnings && !error && <p>Loading earnings...</p>}
        {earnings && (
          <dl>
            <dt>Total earned</dt>
            <dd>{formatBaht(earnings.totalEarned)}</dd>
            <dt>Settled payouts</dt>
            <dd>{earnings.settledRentals}</dd>
          </dl>
        )}
        <p>Demo ledger: these totals do not represent real money transfers.</p>
      </div>
    </Panel>
  );
}
