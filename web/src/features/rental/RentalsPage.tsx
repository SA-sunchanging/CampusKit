import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { listRentals, type Rental, type RentalRole } from '../../api/rental.ts';
import { useAuth } from '../../auth/useAuth.ts';
import { Alert, BoxIcon, EmptyState, PageHeader } from '../../ui/index.ts';
import { useListingTitles } from '../booking/useListingTitles.ts';
import RentalCard from './RentalCard.tsx';
import './rental.css';

const TABS: { role: RentalRole; label: string }[] = [
  { role: 'renter', label: 'Items I rent' },
  { role: 'owner', label: 'Items I lend' },
];

// The student's rentals (role D): items they rent, and their items that others rent.
export default function RentalsPage() {
  const [role, setRole] = useState<RentalRole>('renter');
  return (
    <section>
      <PageHeader title="Rentals" />
      <div className="rental-tabs" role="tablist" aria-label="Rentals">
        {TABS.map((tab) => (
          <button
            key={tab.role}
            type="button"
            role="tab"
            id={`rentals-tab-${tab.role}`}
            aria-selected={tab.role === role}
            aria-controls="rentals-panel"
            className="rental-tab"
            onClick={() => setRole(tab.role)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id="rentals-panel"
        aria-labelledby={`rentals-tab-${role}`}
      >
        <RentalList key={role} role={role} />
      </div>
    </section>
  );
}

interface Loaded {
  rentals?: Rental[];
  error?: string;
}

function RentalList({ role }: { role: RentalRole }) {
  const { user } = useAuth();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const titles = useListingTitles(
    loaded?.rentals?.map((rental) => rental.listingId) ?? [],
  );

  useEffect(() => {
    let active = true;
    listRentals(role)
      .then((rentals) => active && setLoaded({ rentals }))
      .catch((err: Error) => active && setLoaded({ error: err.message }));
    return () => {
      active = false;
    };
  }, [role]);

  if (!loaded) return <p>Loading rentals...</p>;
  if (!loaded.rentals) return <Alert tone="danger">{loaded.error}</Alert>;
  if (loaded.rentals.length === 0) return <NoRentals role={role} />;
  return (
    <div className="rental-list">
      {loaded.rentals.map((rental) => (
        <RentalCard
          key={rental.id}
          rental={rental}
          title={titles[rental.listingId]}
          viewerId={user?.id ?? ''}
        />
      ))}
    </div>
  );
}

function NoRentals({ role }: { role: RentalRole }) {
  if (role === 'owner') {
    return (
      <EmptyState title="No items lent yet" icon={<BoxIcon size={32} />}>
        When you approve a booking for one of your items, its rental shows here.
      </EmptyState>
    );
  }
  return (
    <EmptyState title="No rentals yet" icon={<BoxIcon size={32} />}>
      A rental starts when the owner approves your request. See your{' '}
      <Link to="/bookings">bookings</Link>.
    </EmptyState>
  );
}
