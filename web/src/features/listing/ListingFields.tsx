import { CATEGORIES, CONDITIONS } from '../../api/listing.ts';
import { Panel } from '../../ui/index.ts';
import { FormField } from './FormParts.tsx';
import {
  MAX_ACCESSORIES,
  MAX_ACCESSORY_LENGTH,
  MAX_RENTAL_DAYS,
  type FormErrors,
  type ListingFormState,
} from './listingForm.ts';
import { CATEGORY_LABELS, CONDITION_LABELS } from './options.ts';

// The item and price sections of the create form (role B).
export type Setter = <K extends keyof ListingFormState>(
  key: K,
  value: ListingFormState[K],
) => void;

type MoneyKey = 'dailyRate' | 'deposit' | 'lateFeePerDay' | 'replacementValue';

const MONEY_FIELDS: { key: MoneyKey; label: string; hint: string }[] = [
  { key: 'dailyRate', label: 'Daily rate', hint: 'THB per day' },
  { key: 'deposit', label: 'Deposit', hint: 'THB, returned after the rental' },
  { key: 'lateFeePerDay', label: 'Late fee', hint: 'THB per day late' },
  {
    key: 'replacementValue',
    label: 'Replacement value',
    hint: 'THB, cost to replace the item',
  },
];

interface SectionProps {
  form: ListingFormState;
  set: Setter;
  errors: FormErrors;
}

export function ItemSection({ form, set, errors }: SectionProps) {
  return (
    <Panel title="Item">
      <div className="stack">
        <FormField
          label="Title"
          hint="3 to 100 characters"
          name="title"
          error={errors.title}
        >
          {(invalid) => (
            <input
              {...invalid}
              value={form.title}
              maxLength={100}
              onChange={(event) => set('title', event.target.value)}
            />
          )}
        </FormField>
        <div className="listing-pair">
          <FormField label="Category" name="category" error={errors.category}>
            {(invalid) => (
              <select
                {...invalid}
                value={form.category}
                onChange={(event) =>
                  set(
                    'category',
                    event.target.value as ListingFormState['category'],
                  )
                }
              >
                <option value="">Choose a category</option>
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {CATEGORY_LABELS[category]}
                  </option>
                ))}
              </select>
            )}
          </FormField>
          <FormField
            label="Condition"
            name="condition"
            error={errors.condition}
          >
            {(invalid) => (
              <select
                {...invalid}
                value={form.condition}
                onChange={(event) =>
                  set(
                    'condition',
                    event.target.value as ListingFormState['condition'],
                  )
                }
              >
                <option value="">Choose a condition</option>
                {CONDITIONS.map((condition) => (
                  <option key={condition} value={condition}>
                    {CONDITION_LABELS[condition]}
                  </option>
                ))}
              </select>
            )}
          </FormField>
        </div>
        <FormField
          label="Description"
          hint="10 to 2000 characters"
          name="description"
          error={errors.description}
        >
          {(invalid) => (
            <textarea
              {...invalid}
              value={form.description}
              maxLength={2000}
              rows={5}
              onChange={(event) => set('description', event.target.value)}
            />
          )}
        </FormField>
        <FormField
          label="Accessories"
          hint={`optional; up to ${MAX_ACCESSORIES}, separated by commas or new lines, ${MAX_ACCESSORY_LENGTH} characters each`}
          name="accessories"
          error={errors.accessories}
        >
          {(invalid) => (
            <textarea
              {...invalid}
              value={form.accessories}
              rows={3}
              placeholder="Charger, carrying case"
              onChange={(event) => set('accessories', event.target.value)}
            />
          )}
        </FormField>
      </div>
    </Panel>
  );
}

export function PriceSection({ form, set, errors }: SectionProps) {
  return (
    <Panel title="Price and rules">
      <div className="stack">
        <div className="listing-pair">
          {MONEY_FIELDS.map(({ key, label, hint }) => (
            <FormField
              key={key}
              label={label}
              hint={hint}
              name={key}
              error={errors[key]}
            >
              {(invalid) => (
                <input
                  {...invalid}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0.00"
                  value={form[key]}
                  onChange={(event) => set(key, event.target.value)}
                />
              )}
            </FormField>
          ))}
        </div>
        <FormField
          label="Longest rental"
          hint={`days, 1 to ${MAX_RENTAL_DAYS}`}
          name="maxRentalDays"
          error={errors.maxRentalDays}
        >
          {(invalid) => (
            <input
              {...invalid}
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_RENTAL_DAYS}
              step={1}
              value={form.maxRentalDays}
              onChange={(event) => set('maxRentalDays', event.target.value)}
            />
          )}
        </FormField>
      </div>
    </Panel>
  );
}
