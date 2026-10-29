import type { DateRange, Listing } from '../../api/listing.ts';
import { Alert, Field, formatBaht } from '../../ui/index.ts';
import {
  type BookingDays,
  type BookingFormErrors,
  type DayLimits,
  estimate,
} from './bookingForm.ts';
import type { Availability } from './useAvailability.ts';

// Pieces of the booking request form (role C).

function DayInput({
  name,
  label,
  value,
  min,
  max,
  error,
  onChange,
}: {
  name: string;
  label: string;
  value: string;
  min: string;
  max: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const errorId = `${name}-error`;
  return (
    <div>
      <Field label={label}>
        <input
          type="date"
          name={name}
          value={value}
          min={min}
          max={max}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
      </Field>
      {error && (
        <p className="booking-error" id={errorId}>
          {error}
        </p>
      )}
    </div>
  );
}

/** The pickup and return date inputs with their limits and messages. */
export function DayFields({
  days,
  limits,
  errors,
  onChange,
}: {
  days: BookingDays;
  limits: DayLimits;
  errors: BookingFormErrors;
  onChange: (field: keyof BookingDays, value: string) => void;
}) {
  return (
    <div className="booking-days">
      <DayInput
        name="pickupDay"
        label="Pickup day"
        value={days.pickupDay}
        min={limits.minPickup}
        max={limits.maxPickup}
        error={errors.pickupDay}
        onChange={(value) => onChange('pickupDay', value)}
      />
      <DayInput
        name="returnDay"
        label="Return day"
        value={days.returnDay}
        min={limits.minReturn}
        max={limits.maxReturn}
        error={errors.returnDay}
        onChange={(value) => onChange('returnDay', value)}
      />
    </div>
  );
}

export function EstimateBox({
  period,
  listing,
}: {
  period: DateRange;
  listing: Listing;
}) {
  const { days, rentalFee, deposit, lateFeePerDay } = estimate(period, listing);
  return (
    <div className="booking-estimate">
      <h3>Estimate</h3>
      <dl>
        <dt>Rental fee</dt>
        <dd>
          {days === 1 ? '1 day' : `${days} days`} x{' '}
          {formatBaht(listing.dailyRate)} ={' '}
          <strong>{formatBaht(rentalFee)}</strong>
        </dd>
        <dt>Deposit</dt>
        <dd>{formatBaht(deposit)}, returned after the item comes back</dd>
        <dt>Late fee</dt>
        <dd>{formatBaht(lateFeePerDay)} / day late</dd>
      </dl>
    </div>
  );
}

const AVAILABILITY_TEXT: Partial<Record<Availability, string>> = {
  checking: 'Checking the dates...',
  free: 'These dates are free right now.',
  failed: 'The dates could not be checked. You can still send the request.',
};

/** Result of the advisory check; sending the request checks the dates again. */
export function AvailabilityNote({
  availability,
}: {
  availability: Availability;
}) {
  if (availability === 'taken') {
    return (
      <Alert tone="danger">
        These dates are already taken. Choose other dates.
      </Alert>
    );
  }
  const text = AVAILABILITY_TEXT[availability];
  if (!text) return null;
  return (
    <p className="booking-note" role="status">
      {text}
    </p>
  );
}
