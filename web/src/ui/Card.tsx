import type { ReactNode } from 'react';

// Card for an item in a grid (listing, rental); Panel for a page section.
interface CardProps {
  /** Image or icon area at the top. */
  media?: ReactNode;
  /** Row under the body, for a price and an action. */
  footer?: ReactNode;
  children: ReactNode;
}

export function Card({ media, footer, children }: CardProps) {
  return (
    <article className="card">
      {media && <div className="card-media">{media}</div>}
      <div className="card-body">
        {children}
        {footer && <div className="card-footer">{footer}</div>}
      </div>
    </article>
  );
}

export function Panel({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      {title && <h2>{title}</h2>}
      {children}
    </section>
  );
}
