import { useRef, useState } from 'react';
import { Button, Field } from '../../ui/index.ts';
import { FieldError } from './FormParts.tsx';
import {
  bangkokToday,
  MAX_BLACKOUTS,
  type BlackoutRow,
} from './listingForm.ts';

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

// Rows of unavailable days on the create form. The owner picks both days
// inclusive; listingForm.ts turns them into half-open Bangkok ranges.
export default function BlackoutEditor({
  rows,
  onChange,
  error,
}: {
  rows: BlackoutRow[];
  onChange: (rows: BlackoutRow[]) => void;
  error?: string;
}) {
  const nextKey = useRef(1);
  // Date picker bounds, fixed when the form opens: today to a year ahead.
  const [{ min, max }] = useState(() => {
    const now = new Date();
    return {
      min: bangkokToday(now),
      max: bangkokToday(new Date(now.getTime() + YEAR_MS)),
    };
  });

  function update(key: number, change: Partial<BlackoutRow>) {
    onChange(
      rows.map((row) => (row.key === key ? { ...row, ...change } : row)),
    );
  }

  function setFirstDay(row: BlackoutRow, firstDay: string) {
    // Most periods are short, so start the last day on the first day.
    const keepLast = row.lastDay && row.lastDay >= firstDay;
    update(row.key, { firstDay, lastDay: keepLast ? row.lastDay : firstDay });
  }

  function add() {
    const key = nextKey.current;
    nextKey.current += 1;
    onChange([...rows, { key, firstDay: '', lastDay: '' }]);
  }

  return (
    <fieldset
      className="listing-choices"
      aria-describedby={error ? 'blackouts-error' : undefined}
    >
      <legend>
        Unavailable dates <span className="field-hint">(optional)</span>
      </legend>
      <p>
        Days you will not rent the item out, for example during exams. Both days
        are included.
      </p>
      {rows.map((row, index) => (
        <div className="listing-period" key={row.key}>
          <div className="listing-pair">
            <Field label="First unavailable day" hint={`period ${index + 1}`}>
              <input
                type="date"
                min={min}
                max={max}
                value={row.firstDay}
                aria-invalid={error ? true : undefined}
                onChange={(event) => setFirstDay(row, event.target.value)}
              />
            </Field>
            <Field label="Last unavailable day" hint={`period ${index + 1}`}>
              <input
                type="date"
                min={row.firstDay || min}
                max={max}
                value={row.lastDay}
                aria-invalid={error ? true : undefined}
                onChange={(event) =>
                  update(row.key, { lastDay: event.target.value })
                }
              />
            </Field>
          </div>
          <div className="actions">
            <Button
              variant="ghost"
              size="small"
              onClick={() => onChange(rows.filter((r) => r.key !== row.key))}
            >
              Remove period {index + 1}
            </Button>
          </div>
        </div>
      ))}
      <FieldError name="blackouts" error={error} />
      <div className="actions">
        <Button
          variant="ghost"
          disabled={rows.length >= MAX_BLACKOUTS}
          onClick={add}
        >
          Add unavailable period
        </Button>
      </div>
    </fieldset>
  );
}
