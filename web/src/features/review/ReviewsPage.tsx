import { EmptyState, PageHeader, StarIcon } from '../../ui/index.ts';

// Placeholder. Review the other participant (role E).
export default function ReviewsPage() {
  return (
    <section>
      <PageHeader title="Reviews" />
      <EmptyState title="Reviews are coming soon" icon={<StarIcon size={32} />}>
        Review the other participant (role E).
      </EmptyState>
    </section>
  );
}
