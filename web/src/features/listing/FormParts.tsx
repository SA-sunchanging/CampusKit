import type { ReactNode } from 'react';
import { PICKUP_LOCATIONS, type PickupLocation } from '../../api/listing.ts';
import { Field } from '../../ui/index.ts';
import { MAX_PICKUP_LOCATIONS } from './listingForm.ts';
import { PICKUP_LABELS } from './options.ts';

// Form pieces for the create page (role B): a field with its error message, and
// the pickup checkboxes.
interface InvalidProps {
  'aria-invalid'?: true;
  'aria-describedby'?: string;
}

function invalidProps(name: string, error?: string): InvalidProps {
  return error
    ? { 'aria-invalid': true, 'aria-describedby': `${name}-error` }
    : {};
}

export function FieldError({ name, error }: { name: string; error?: string }) {
  if (!error) return null;
  return (
    <p className="listing-error" id={`${name}-error`}>
      {error}
    </p>
  );
}

/** A Field whose control gets aria-invalid and the error's id when the value is invalid. */
export function FormField({
  label,
  hint,
  name,
  error,
  children,
}: {
  label: string;
  hint?: string;
  name: string;
  error?: string;
  children: (invalid: InvalidProps) => ReactNode;
}) {
  return (
    <div>
      <Field label={label} hint={hint}>
        {children(invalidProps(name, error))}
      </Field>
      <FieldError name={name} error={error} />
    </div>
  );
}

export function PickupChoices({
  value,
  onChange,
  error,
}: {
  value: PickupLocation[];
  onChange: (value: PickupLocation[]) => void;
  error?: string;
}) {
  const full = value.length >= MAX_PICKUP_LOCATIONS;
  function toggle(location: PickupLocation, checked: boolean) {
    onChange(
      checked
        ? [...value, location]
        : value.filter((item) => item !== location),
    );
  }
  return (
    <fieldset
      className="listing-choices"
      aria-describedby={error ? 'pickupLocations-error' : undefined}
    >
      <legend>
        Pickup locations{' '}
        <span className="field-hint">(1 to {MAX_PICKUP_LOCATIONS})</span>
      </legend>
      {PICKUP_LOCATIONS.map((location) => {
        const checked = value.includes(location);
        return (
          <label key={location} className="listing-check">
            <input
              type="checkbox"
              name="pickupLocations"
              value={location}
              checked={checked}
              disabled={full && !checked}
              aria-invalid={error ? true : undefined}
              onChange={(event) => toggle(location, event.target.checked)}
            />
            {PICKUP_LABELS[location]}
          </label>
        );
      })}
      <FieldError name="pickupLocations" error={error} />
    </fieldset>
  );
}
