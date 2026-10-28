import { EmptyState, PageHeader, BellIcon } from '../../ui/index.ts';

// Placeholder. In-app notifications (role E).
export default function InboxPage() {
  return (
    <section>
      <PageHeader title="Inbox" />
      <EmptyState
        title="Your inbox is coming soon"
        icon={<BellIcon size={32} />}
      >
        In-app notifications (role E).
      </EmptyState>
    </section>
  );
}
