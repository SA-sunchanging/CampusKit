import { EmptyState, PageHeader, ShieldIcon } from '../../ui/index.ts';

// Placeholder. Student verification and listing moderation (role B).
export default function AdminPage() {
  return (
    <section>
      <PageHeader title="Admin" />
      <EmptyState
        title="Admin tools are coming soon"
        icon={<ShieldIcon size={32} />}
      >
        Student verification and listing moderation (role B).
      </EmptyState>
    </section>
  );
}
