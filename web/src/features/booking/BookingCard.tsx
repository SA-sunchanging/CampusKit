import { Link } from 'react-router';
import type { Booking, BookingRole } from '../../api/booking.ts';
import { Badge, formatBaht, formatDateRange } from '../../ui/index.ts';
import { rentalDays } from './bookingForm.ts';
import { formatDateTime } from './dates.ts';
import OwnerActions from './OwnerActions.tsx';
import { ownerAction, statusLabel, statusTone } from './status.ts';

// One booking on the bookings page (role C), seen as its renter or its owner.
export default function BookingCard({
  booking,
  title,
  role,
  onChange,
}: {
  booking: Booking;
  /** Undefined while loading; null when the listing could not be loaded. */
  title: string | null | undefined;
  role: BookingRole;
  onChange: (booking: Booking) => void;
}) {
  const { period, terms } = booking;
  const days = rentalDays(period);
  const action = ownerAction(booking, role);
  return (
    <article className="panel booking-card">
      <div className="booking-card-head">
        <h3>
          <Link to={`/listings/${booking.listingId}`}>
            {title ?? (title === null ? 'View listing' : 'Loading title...')}
          </Link>
        </h3>
        <Badge tone={statusTone(booking.status)}>
          {statusLabel(booking.status)}
        </Badge>
      </div>
      <p>
        {formatDateRange(period.start, period.end)} (
        {days === 1 ? '1 day' : `${days} days`})
      </p>
      <dl>
        <dt>Rental fee</dt>
        <dd>{formatBaht(terms.rentalFee)}</dd>
        <dt>Deposit</dt>
        <dd>{formatBaht(terms.deposit)}</dd>
        <dt>Late fee</dt>
        <dd>{formatBaht(terms.lateFeePerDay)} / day late</dd>
      </dl>
      <StatusNote booking={booking} role={role} />
      {action && (
        <OwnerActions booking={booking} action={action} onChange={onChange} />
      )}
    </article>
  );
}

function StatusNote({
  booking,
  role,
}: {
  booking: Booking;
  role: BookingRole;
}) {
  if (booking.status === 'PENDING') {
    const until = formatDateTime(booking.expiresAt);
    return (
      <p className="booking-note">
        {role === 'owner'
          ? `Answer by ${until}, or the request expires.`
          : `The owner has until ${until} to answer.`}
      </p>
    );
  }
  if (booking.status === 'DECLINED' && booking.declineReason) {
    return <p>Reason: {booking.declineReason}</p>;
  }
  if (booking.status === 'AUTHORIZING' && role === 'renter') {
    return (
      <p className="booking-note">
        The owner approved. Payment authorization is not finished yet.
      </p>
    );
  }
  return null;
}
