import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import {
  CATEGORIES,
  searchListings,
  searchQuery,
  type ListingPage,
  type SearchParams,
} from '../../api/listing.ts';
import { useAuth } from '../../auth/useAuth.ts';
import {
  Alert,
  Button,
  ButtonLink,
  EmptyState,
  Field,
  Hero,
  PageHeader,
  Panel,
} from '../../ui/index.ts';
import ListingCard from './ListingCard.tsx';
import { CATEGORY_LABELS } from './options.ts';
import {
  MAX_KEYWORD_LENGTH,
  PAGE_SIZE,
  pageCount,
  readSearch,
} from './search.ts';
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const filters = new URLSearchParams({
      q: String(form.get('q') ?? ''),
      category: String(form.get('category') ?? ''),
    });
    // A new search starts again at page 1.
    setParams(searchQuery({ ...readSearch(filters), page: 1 }));
  }

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
          <form
            key={`${search.q ?? ''}|${search.category ?? ''}`}
            className="stack"
            role="search"
            onSubmit={handleSubmit}
          >
            <Field label="Keyword">
              <input
                name="q"
                type="search"
                maxLength={MAX_KEYWORD_LENGTH}
                defaultValue={search.q ?? ''}
                placeholder="Textbook, racket, gown..."
              />
            </Field>
            <Field label="Category">
              <select name="category" defaultValue={search.category ?? ''}>
                <option value="">All categories</option>
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {CATEGORY_LABELS[category]}
                  </option>
                ))}
              </select>
            </Field>
            <div className="actions">
              <Button type="submit">Search</Button>
            </div>
          </form>
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
  const filtered = Boolean(search.q || search.category);
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
              ? 'Try another keyword or category.'
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
