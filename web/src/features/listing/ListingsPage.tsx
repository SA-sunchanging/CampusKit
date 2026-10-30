import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import {
  searchListings,
  searchQuery,
  type ListingPage,
  type SearchParams,
} from '../../api/listing.ts';
import { useAuth } from '../../auth/useAuth.ts';
import {
  Alert,
  ButtonLink,
  EmptyState,
  Hero,
  PageHeader,
  Panel,
} from '../../ui/index.ts';
import ListingCard from './ListingCard.tsx';
import { PAGE_SIZE, pageCount, readSearch } from './search.ts';
import SearchForm from './SearchForm.tsx';
import './listing.css';

interface Results {
  /** The query these results answer, to tell stale results from fresh ones. */
  query: string;
  page?: ListingPage;
  error?: string;
}

// Search published listings (role B). Public, so guests can browse.
export default function ListingsPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const search = useMemo(() => readSearch(params), [params]);
  const query = searchQuery({ ...search, pageSize: PAGE_SIZE });
  const [results, setResults] = useState<Results | null>(null);

  useEffect(() => {
    let active = true;
    const request = { ...search, pageSize: PAGE_SIZE };
    const answer = searchQuery(request);
    searchListings(request)
      .then((page) => active && setResults({ query: answer, page }))
      .catch(
        (err: Error) =>
          active && setResults({ query: answer, error: err.message }),
      );
    return () => {
      active = false;
    };
  }, [search]);

  const current = results?.query === query ? results : null;

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
        <PageHeader
          title="Listings"
          aside={
            user?.role === 'student' && (
              <ButtonLink to="/listings/new" size="small">
                List an item
              </ButtonLink>
            )
          }
        />
        <Panel>
          <SearchForm
            search={search}
            onSearch={(next) => setParams(searchQuery(next))}
          />
        </Panel>
        {!current && <p>Loading listings...</p>}
        {current?.error && <Alert tone="danger">{current.error}</Alert>}
        {current?.page && <ResultList page={current.page} search={search} />}
      </section>
    </>
  );
}

function ResultList({
  page,
  search,
}: {
  page: ListingPage;
  search: SearchParams;
}) {
  const pages = pageCount(page.total, page.pageSize);
  const filtered = Boolean(
    search.q || search.category || search.location || search.period,
  );
  return (
    <>
      <p aria-live="polite">
        {page.total === 1 ? '1 listing' : `${page.total} listings`}
        {filtered
          ? page.total === 1
            ? ' matches your search'
            : ' match your search'
          : ' available'}
      </p>
      {page.items.length === 0 ? (
        <EmptyState title="No listings found">
          {page.page > pages
            ? 'This page is past the last result.'
            : filtered
              ? 'Try other filters or dates.'
              : 'Nothing is listed yet. Check back soon.'}
        </EmptyState>
      ) : (
        <div className="grid">
          {page.items.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
      {(pages > 1 || page.page > 1) && (
        <Pager page={page.page} pages={pages} search={search} />
      )}
    </>
  );
}

function Pager({
  page,
  pages,
  search,
}: {
  page: number;
  pages: number;
  search: SearchParams;
}) {
  const linkTo = (target: number) => ({
    search: searchQuery({ ...search, page: target }),
  });
  return (
    <nav className="listing-pager" aria-label="Result pages">
      {page > 1 ? (
        <ButtonLink
          variant="ghost"
          size="small"
          to={linkTo(Math.min(page - 1, pages))}
        >
          Previous
        </ButtonLink>
      ) : (
        <span />
      )}
      <span>
        Page {page} of {pages}
      </span>
      {page < pages ? (
        <ButtonLink variant="ghost" size="small" to={linkTo(page + 1)}>
          Next
        </ButtonLink>
      ) : (
        <span />
      )}
    </nav>
  );
}
