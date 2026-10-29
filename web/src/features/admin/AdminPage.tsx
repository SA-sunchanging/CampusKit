import { type ComponentType, useState } from 'react';
import { PageHeader } from '../../ui/index.ts';
import ListingReview from './ListingReview.tsx';
import StudentReview from './StudentReview.tsx';
import './admin.css';

// One entry per admin tool; add a tab by adding a line here.
const TABS: { id: string; label: string; Panel: ComponentType }[] = [
  { id: 'listings', label: 'Listings', Panel: ListingReview },
  { id: 'students', label: 'Students', Panel: StudentReview },
];

// Administrator tools (role B), one tab each.
export default function AdminPage() {
  const [current, setCurrent] = useState(TABS[0]);
  return (
    <section>
      <PageHeader title="Admin" />
      <div className="admin-tabs" role="tablist" aria-label="Admin tools">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`admin-tab-${tab.id}`}
            aria-selected={tab.id === current.id}
            aria-controls="admin-panel"
            className="admin-tab"
            onClick={() => setCurrent(tab)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id="admin-panel"
        aria-labelledby={`admin-tab-${current.id}`}
      >
        <current.Panel key={current.id} />
      </div>
    </section>
  );
}
