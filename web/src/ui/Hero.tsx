import type { ReactNode } from 'react';
import { BagIcon, CalendarIcon, StarIcon } from './icons.tsx';

// Large intro block for the home page.
interface HeroProps {
  eyebrow: string;
  title: string;
  tags?: string[];
  children?: ReactNode;
}

export function Hero({ eyebrow, title, tags = [], children }: HeroProps) {
  return (
    <section className="hero">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {children}
        {tags.length > 0 && (
          <div className="hero-tags">
            {tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        )}
      </div>
      <div className="hero-art" aria-hidden="true">
        <span className="bubble bubble-1">
          <BagIcon size={64} />
        </span>
        <span className="bubble bubble-2">
          <CalendarIcon size={48} />
        </span>
        <span className="bubble bubble-3">
          <StarIcon size={52} />
        </span>
      </div>
    </section>
  );
}
