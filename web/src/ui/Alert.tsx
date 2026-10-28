import type { ReactNode } from 'react';

// Result message after an action. Errors are announced at once.
export function Alert({
  tone,
  children,
}: {
  tone: 'success' | 'danger';
  children: ReactNode;
}) {
  return (
    <p
      className={`alert tone-${tone}`}
      role={tone === 'danger' ? 'alert' : 'status'}
    >
      {children}
    </p>
  );
}
