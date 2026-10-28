import type { ReactNode } from 'react';

// Page title with an optional note or action on the right.
export function PageHeader({
  title,
  aside,
}: {
  title: string;
  aside?: ReactNode;
}) {
  return (
    <div className="page-header">
      <h2>{title}</h2>
      {aside && <div className="page-header-aside">{aside}</div>}
    </div>
  );
}
