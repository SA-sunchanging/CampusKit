import { useState, type FormEvent } from 'react';
import {
  CATEGORIES,
  PICKUP_LOCATIONS,
  type SearchParams,
} from '../../api/listing.ts';
import { Alert, Button, Field } from '../../ui/index.ts';
import { CATEGORY_LABELS, PICKUP_LABELS } from './options.ts';
import {
  MAX_KEYWORD_LENGTH,
  periodDays,
  periodFromDays,
  readSearch,
} from './search.ts';

// The search filters (role B): keyword, category, pickup point, and the days
// the item must be free. A new search starts again at page 1.
export default function SearchForm({
  search,
  onSearch,
}: {
  search: SearchParams;
  onSearch: (search: SearchParams) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const days = periodDays(search.period);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const field = (name: string) => String(form.get(name) ?? '');
    const dates = periodFromDays(field('pickupDay'), field('returnDay'));
    if (dates.error) {
      setError(dates.error);
      return;
    }
    setError(null);
    const filters = new URLSearchParams({
      q: field('q'),
      category: field('category'),
      location: field('location'),
    });
    onSearch({ ...readSearch(filters), period: dates.period, page: 1 });
  }

  return (
    <form
      key={[
        search.q,
        search.category,
        search.location,
        days.pickupDay,
        days.returnDay,
      ].join('|')}
      className="stack"
      role="search"
      onSubmit={handleSubmit}
    >
      <Field label="Keyword">
        <input
          name="q"
          type="search"
          maxLength={MAX_KEYWORD_LENGTH}
          defaultValue={search.q ?? ''}
          placeholder="Textbook, racket, gown..."
        />
      </Field>
      <Field label="Category">
        <select name="category" defaultValue={search.category ?? ''}>
          <option value="">All categories</option>
          {CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {CATEGORY_LABELS[category]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Pickup point">
        <select name="location" defaultValue={search.location ?? ''}>
          <option value="">Any pickup point</option>
          {PICKUP_LOCATIONS.map((location) => (
            <option key={location} value={location}>
              {PICKUP_LABELS[location]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Pickup day" hint="optional">
        <input name="pickupDay" type="date" defaultValue={days.pickupDay} />
      </Field>
      <Field label="Return day" hint="optional">
        <input name="returnDay" type="date" defaultValue={days.returnDay} />
      </Field>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="actions">
        <Button type="submit">Search</Button>
      </div>
    </form>
  );
}
