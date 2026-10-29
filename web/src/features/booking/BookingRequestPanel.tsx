import { type FormEvent, useState } from 'react';
import { Link, useLocation } from 'react-router';
import type { Listing } from '../../api/listing.ts';
import { useAuth } from '../../auth/useAuth.ts';
import { Alert, Button, Panel } from '../../ui/index.ts';
import {
  AvailabilityNote,
  DayFields,
  EstimateBox,
} from './BookingFormParts.tsx';
import {
  type BookingDays,
  dayLimits,
  EMPTY_DAYS,
  toBookingPeriod,
  validateBookingDays,
} from './bookingForm.ts';
import { formatDateTime } from './dates.ts';
import { useAvailability } from './useAvailability.ts';
import { useBookingRequest } from './useBookingRequest.ts';
import './booking.css';

// Booking request form on the listing detail page (role C). Students who do not
// own the listing request dates; guests are asked to log in first.
export default function BookingRequestPanel({ listing }: { listing: Listing }) {
  const { user } = useAuth();
  const location = useLocation();
  if (listing.status !== 'PUBLISHED') return null;
  if (!user) {
    return (
      <Panel title="Request to book">
        <p>
          <Link to="/login" state={{ from: location }}>
            Log in
          </Link>{' '}
          to request dates for this item.
        </p>
      </Panel>
    );
  }
  // Only students rent items; admins moderate.
  if (user.role !== 'student') return null;
  return <RequestForm listing={listing} />;
}

function RequestForm({ listing }: { listing: Listing }) {
  const [now] = useState(() => new Date());
  const [days, setDays] = useState<BookingDays>(EMPTY_DAYS);
  const [tried, setTried] = useState(false);
  const { pending, error, sent, send, clearSent } = useBookingRequest(
    listing.id,
  );

  const errors = validateBookingDays(days, listing.maxRentalDays, now);
  const valid = Object.keys(errors).length === 0;
  const period = valid ? toBookingPeriod(days) : null;
  const availability = useAvailability(listing.id, period);
  // Show a message once the field has a value, or after a send attempt.
  const shown = Object.fromEntries(
    Object.entries(errors).filter(
      ([field]) => tried || days[field as keyof BookingDays],
    ),
  );

  function change(field: keyof BookingDays, value: string) {
    setDays((current) => ({ ...current, [field]: value }));
    clearSent();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setTried(true);
    if (period && (await send(period))) {
      setDays(EMPTY_DAYS);
      setTried(false);
    }
  }

  return (
    <Panel title="Request to book">
      <form
        className="booking-form"
        noValidate
        onSubmit={(event) => void handleSubmit(event)}
      >
        <DayFields
          days={days}
          limits={dayLimits(days.pickupDay, listing.maxRentalDays, now)}
          errors={shown}
          onChange={change}
        />
        {period && <EstimateBox period={period} listing={listing} />}
        <AvailabilityNote availability={availability} />
        {error && <Alert tone="danger">{error}</Alert>}
        {sent && (
          <Alert tone="success">
            Request sent. The owner has until {formatDateTime(sent.expiresAt)}{' '}
            to answer. <Link to="/bookings">See your bookings</Link>
          </Alert>
        )}
        <div className="actions">
          <Button type="submit" disabled={pending || availability === 'taken'}>
            {pending ? 'Sending...' : 'Send request'}
          </Button>
        </div>
        <p className="booking-note">
          The item is reserved for you while the owner decides. Payment is
          authorized only when the owner approves.
        </p>
      </form>
    </Panel>
  );
}
