import type { ReactNode } from 'react';

// Status pill. Each owning role maps its own status values to a tone.
export type Tone = 'neutral' | 'success' | 'warning' | 'danger';

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  return <span className={`badge tone-${tone}`}>{children}</span>;
}
