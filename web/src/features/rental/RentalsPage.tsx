import { EmptyState, PageHeader, BoxIcon } from '../../ui/index.ts';

// Placeholder. Pickup, return, and payment status (role D).
export default function RentalsPage() {
  return (
    <section>
      <PageHeader title="Rentals" />
      <EmptyState title="Rentals are coming soon" icon={<BoxIcon size={32} />}>
        Pickup, return, and payment status (role D).
      </EmptyState>
    </section>
  );
}
