import { Link } from 'react-router';
import type { Rental } from '../../api/rental.ts';
import { formatBaht, formatDateRange, Panel } from '../../ui/index.ts';
import { formatDateTime } from '../booking/dates.ts';

// Period, terms and the handover times of a rental (role D).
export default function RentalFacts({ rental }: { rental: Rental }) {
  const { period, terms } = rental;
  return (
    <Panel title="Rental">
      <dl>
        <dt>Period</dt>
        <dd>{formatDateRange(period.start, period.end)}</dd>
        <dt>Rental fee</dt>
        <dd>{formatBaht(terms.rentalFee)}</dd>
        <dt>Deposit</dt>
        <dd>{formatBaht(terms.deposit)}</dd>
        <dt>Late fee</dt>
        <dd>{formatBaht(terms.lateFeePerDay)} / day late</dd>
        <Time label="Picked up" iso={rental.pickedUpAt} />
        <Time label="Returned" iso={rental.returnedAt} />
        {rental.lateDays > 0 && (
          <>
            <dt>Days late</dt>
            <dd>
              {rental.lateDays === 1 ? '1 day' : `${rental.lateDays} days`}
            </dd>
          </>
        )}
        {rental.lateFee > 0 && (
          <>
            <dt>Late fee due</dt>
            <dd>{formatBaht(rental.lateFee)}</dd>
          </>
        )}
        <Time label="Closed" iso={rental.closedAt} />
      </dl>
      <p className="rental-facts-link">
        <Link to={`/listings/${rental.listingId}`}>View the listing</Link>
      </p>
    </Panel>
  );
}

/** An empty time is not set yet, so it is left out. */
function Time({ label, iso }: { label: string; iso: string }) {
  if (!iso) return null;
  return (
    <>
      <dt>{label}</dt>
      <dd>{formatDateTime(iso)}</dd>
    </>
  );
}
