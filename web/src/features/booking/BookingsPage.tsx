import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import {
  type Booking,
  type BookingRole,
  listBookings,
} from '../../api/booking.ts';
import { Alert, CalendarIcon, EmptyState, PageHeader } from '../../ui/index.ts';
import BookingCard from './BookingCard.tsx';
import { useListingTitles } from './useListingTitles.ts';
import './booking.css';

const TABS: { role: BookingRole; label: string }[] = [
  { role: 'renter', label: 'My requests' },
  { role: 'owner', label: 'Requests for my items' },
];

// The student's bookings (role C): their own requests, and requests on their items.
export default function BookingsPage() {
  const [role, setRole] = useState<BookingRole>('renter');
  return (
    <section>
      <PageHeader title="Bookings" />
      <div className="booking-tabs" role="tablist" aria-label="Bookings">
        {TABS.map((tab) => (
          <button
            key={tab.role}
            type="button"
            role="tab"
            id={`bookings-tab-${tab.role}`}
            aria-selected={tab.role === role}
            aria-controls="bookings-panel"
            className="booking-tab"
            onClick={() => setRole(tab.role)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id="bookings-panel"
        aria-labelledby={`bookings-tab-${role}`}
      >
        <BookingList key={role} role={role} />
      </div>
    </section>
  );
}

interface Loaded {
  bookings?: Booking[];
  error?: string;
}

function BookingList({ role }: { role: BookingRole }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const titles = useListingTitles(
    loaded?.bookings?.map((booking) => booking.listingId) ?? [],
  );

  useEffect(() => {
    let active = true;
    listBookings(role)
      .then((bookings) => active && setLoaded({ bookings }))
      .catch((err: Error) => active && setLoaded({ error: err.message }));
    return () => {
      active = false;
    };
  }, [role]);

  function replace(next: Booking) {
    setLoaded((current) => ({
      bookings: current?.bookings?.map((booking) =>
        booking.id === next.id ? next : booking,
      ),
    }));
  }

  if (!loaded) return <p>Loading bookings...</p>;
  if (!loaded.bookings) return <Alert tone="danger">{loaded.error}</Alert>;
  if (loaded.bookings.length === 0) return <NoBookings role={role} />;
  return (
    <div className="booking-list">
      {loaded.bookings.map((booking) => (
        <BookingCard
          key={booking.id}
          booking={booking}
          title={titles[booking.listingId]}
          role={role}
          onChange={replace}
        />
      ))}
    </div>
  );
}

function NoBookings({ role }: { role: BookingRole }) {
  if (role === 'owner') {
    return (
      <EmptyState
        title="No requests for your items yet"
        icon={<CalendarIcon size={32} />}
      >
        Requests from other students show here for you to approve or decline.
      </EmptyState>
    );
  }
  return (
    <EmptyState title="No requests yet" icon={<CalendarIcon size={32} />}>
      Find an item on the <Link to="/">listings page</Link> and request dates.
    </EmptyState>
  );
}
