import { useState } from 'react';
import { Link } from 'react-router';
import type { Rental } from '../../api/rental.ts';
import {
  Badge,
  ButtonLink,
  formatBaht,
  formatDateRange,
} from '../../ui/index.ts';
import {
  nextStepNote,
  overdueNote,
  statusLabel,
  statusTone,
} from './status.ts';

// One rental on the rentals page (role D), seen as its renter or its owner.
export default function RentalCard({
  rental,
  title,
  viewerId,
}: {
  rental: Rental;
  /** Undefined while loading; null when the listing could not be loaded. */
  title: string | null | undefined;
  viewerId: string;
}) {
  const { period, terms } = rental;
  const [now] = useState(() => new Date());
  const note = nextStepNote(rental, viewerId, now);
  const overdue = overdueNote(rental);
  const link = `/rentals/${rental.id}`;
  return (
    <article className="panel rental-card">
      <div className="rental-card-head">
        <h3>
          <Link to={link}>
            {title ?? (title === null ? 'Rental' : 'Loading title...')}
          </Link>
        </h3>
        <Badge tone={statusTone(rental.status)}>
          {statusLabel(rental.status)}
        </Badge>
        {rental.overdue && <Badge tone="danger">Overdue</Badge>}
      </div>
      <p>{formatDateRange(period.start, period.end)}</p>
      {overdue && <p className="rental-overdue">{overdue}</p>}
      <dl>
        <dt>Rental fee</dt>
        <dd>{formatBaht(terms.rentalFee)}</dd>
        <dt>Deposit</dt>
        <dd>{formatBaht(terms.deposit)}</dd>
        <dt>Late fee</dt>
        <dd>{formatBaht(terms.lateFeePerDay)} / day late</dd>
      </dl>
      {note && <p className="rental-note">{note}</p>}
      <div className="actions">
        <ButtonLink to={link} size="small">
          Open rental
        </ButtonLink>
      </div>
    </article>
  );
}
