import { EmptyState, Hero, PageHeader } from '../../ui/index.ts';

// Placeholder. Search, listing detail, create listing (role B).
export default function ListingsPage() {
  return (
    <>
      <Hero
        eyebrow="FOR CHULA STUDENTS"
        title="Borrow a little, do a lot."
        tags={['Verified students', 'Deposit protected', 'Campus pickup']}
      >
        <p>
          Rent textbooks, sports gear, and costumes from other students on
          campus.
        </p>
      </Hero>
      <section>
        <PageHeader title="Listings" />
        <EmptyState title="Listings are coming soon">
          Search, listing detail, create listing (role B).
        </EmptyState>
      </section>
    </>
  );
}
