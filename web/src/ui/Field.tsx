import type { ReactNode } from 'react';

// A labelled form control. Put one input, select, or textarea inside.
interface FieldProps {
  label: string;
  hint?: string;
  children: ReactNode;
}

export function Field({ label, hint, children }: FieldProps) {
  return (
    <label className="field">
      <span>
        {label}
        {hint && <span className="field-hint"> ({hint})</span>}
      </span>
      {children}
    </label>
  );
}
