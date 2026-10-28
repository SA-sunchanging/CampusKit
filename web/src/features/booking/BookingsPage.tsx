import { EmptyState, PageHeader, CalendarIcon } from '../../ui/index.ts';

// Placeholder. Request, approve, and track bookings (role C).
export default function BookingsPage() {
  return (
    <section>
      <PageHeader title="Bookings" />
      <EmptyState
        title="Bookings are coming soon"
        icon={<CalendarIcon size={32} />}
      >
        Request, approve, and track bookings (role C).
      </EmptyState>
    </section>
  );
}
