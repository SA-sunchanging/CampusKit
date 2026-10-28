import type { ReactNode } from 'react';
import { BoxIcon } from './icons.tsx';

// Shown when a list has nothing in it yet.
interface EmptyStateProps {
  title: string;
  icon?: ReactNode;
  children?: ReactNode;
}

export function EmptyState({ title, icon, children }: EmptyStateProps) {
  return (
    <div className="empty">
      {icon ?? <BoxIcon size={32} />}
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  );
}
