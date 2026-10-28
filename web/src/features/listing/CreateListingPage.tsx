import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { createListing } from '../../api/listing.ts';
import { Alert, Button, PageHeader, Panel } from '../../ui/index.ts';
import BlackoutEditor from './BlackoutEditor.tsx';
import { PickupChoices } from './FormParts.tsx';
import { ItemSection, PriceSection, type Setter } from './ListingFields.tsx';
import {
  EMPTY_FORM,
  toCreateBody,
  validateListingForm,
  type ListingFormState,
} from './listingForm.ts';
import PhotoPicker from './PhotoPicker.tsx';
import './listing.css';

// Create a listing (role B). The service publishes it at once; if Booking cannot
// set up the calendar, it stays a DRAFT and the detail page offers a retry.
export default function CreateListingPage() {
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState<ListingFormState>(EMPTY_FORM);
  const [attempts, setAttempts] = useState(0);
  const [photosBusy, setPhotosBusy] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check the fields only after the first submit, then on every change.
  const errors = attempts > 0 ? validateListingForm(form) : {};
  const errorCount = Object.keys(errors).length;

  // After a failed submit, move the keyboard focus to the first invalid field.
  useEffect(() => {
    if (attempts === 0) return;
    formRef.current
      ?.querySelector<HTMLElement>('[aria-invalid="true"]')
      ?.focus();
  }, [attempts]);

  const set: Setter = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAttempts((count) => count + 1);
    if (photosBusy || Object.keys(validateListingForm(form)).length > 0) return;
    setPending(true);
    setError(null);
    try {
      const listing = await createListing(toCreateBody(form));
      void navigate(`/listings/${listing.id}`);
    } catch (err) {
      setError((err as Error).message);
      setPending(false);
    }
  }

  return (
    <section>
      <PageHeader title="List an item" aside={<Link to="/">Cancel</Link>} />
      <form
        ref={formRef}
        className="stack listing-form"
        noValidate
        onSubmit={(event) => void handleSubmit(event)}
      >
        <ItemSection form={form} set={set} errors={errors} />
        <PriceSection form={form} set={set} errors={errors} />
        <Panel title="Pickup">
          <PickupChoices
            value={form.pickupLocations}
            onChange={(value) => set('pickupLocations', value)}
            error={errors.pickupLocations}
          />
        </Panel>
        <Panel title="Availability">
          <BlackoutEditor
            rows={form.blackouts}
            onChange={(rows) => set('blackouts', rows)}
            error={errors.blackouts}
          />
        </Panel>
        <Panel title="Photos">
          <PhotoPicker
            photos={form.photos}
            onChange={(update) =>
              setForm((current) => ({
                ...current,
                photos: update(current.photos),
              }))
            }
            busy={photosBusy}
            onBusyChange={setPhotosBusy}
            error={errors.photos}
          />
        </Panel>
        {errorCount > 0 && (
          <Alert tone="danger">
            Please fix {errorCount === 1 ? '1 field' : `${errorCount} fields`}{' '}
            above.
          </Alert>
        )}
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="actions">
          <Button type="submit" disabled={pending || photosBusy}>
            {pending ? 'Publishing...' : 'Publish listing'}
          </Button>
        </div>
      </form>
    </section>
  );
}
