import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import {
  getMyListings,
  searchQuery,
  type OwnerListingPage,
  type OwnerListingSummary,
} from '../../api/listing.ts';
import { useAuth } from '../../auth/useAuth.ts';
import {
  Alert,
  Badge,
  BoxIcon,
  ButtonLink,
  Card,
  EmptyState,
  formatBaht,
  PageHeader,
} from '../../ui/index.ts';
import { CATEGORY_LABELS, STATUS_LABELS, STATUS_TONE } from './options.ts';
import { PAGE_SIZE, pageCount, readSearch } from './search.ts';
import './listing.css';

interface Results {
  key: string;
  page?: OwnerListingPage;
  error?: string;
}

/** Owner catalogue, including drafts and listings removed from public search. */
export default function MyListingsPage() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const page = readSearch(params).page ?? 1;
  const key = `${user?.id}:${page}`;
  const [results, setResults] = useState<Results | null>(null);

  useEffect(() => {
    let active = true;
    getMyListings(page, PAGE_SIZE)
      .then((answer) => active && setResults({ key, page: answer }))
      .catch((err: Error) => active && setResults({ key, error: err.message }));
    return () => {
      active = false;
    };
  }, [key, page]);

  const current = results?.key === key ? results : null;
  return (
    <section className="stack">
      <PageHeader
        title="My listings"
        aside={<ButtonLink to="/listings/new">List an item</ButtonLink>}
      />
      <p>
        Your listings in every status. Open a listing to see its details, retry
        publishing a draft, or unpublish an available item.
      </p>
      {!current && <p>Loading your listings...</p>}
      {current?.error && <Alert tone="danger">{current.error}</Alert>}
      {current?.page && <OwnerResults page={current.page} />}
    </section>
  );
}

function OwnerResults({ page }: { page: OwnerListingPage }) {
  const pages = pageCount(page.total, page.pageSize);
  return (
    <>
      <p aria-live="polite">
        {page.total === 1 ? '1 listing' : `${page.total} listings`}
      </p>
      {page.items.length === 0 ? (
        <EmptyState
          title={
            page.total === 0 ? 'No listings yet' : 'No listings on this page'
          }
        >
          {page.total === 0
            ? 'List an item to make it available to other students.'
            : 'Use Previous to return to your listings.'}
        </EmptyState>
      ) : (
        <div className="grid">
          {page.items.map((listing) => (
            <OwnerCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
      {(pages > 1 || page.page > 1) && (
        <nav className="listing-pager" aria-label="My listing pages">
          {page.page > 1 ? (
            <ButtonLink
              variant="ghost"
              size="small"
              to={{
                search: searchQuery({ page: Math.min(page.page - 1, pages) }),
              }}
            >
              Previous
            </ButtonLink>
          ) : (
            <span />
          )}
          <span>
            Page {page.page} of {pages}
          </span>
          {page.page < pages ? (
            <ButtonLink
              variant="ghost"
              size="small"
              to={{ search: searchQuery({ page: page.page + 1 }) }}
            >
              Next
            </ButtonLink>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}

function OwnerCard({ listing }: { listing: OwnerListingSummary }) {
  return (
    <Card
      media={
        <>
          {listing.thumbnail ? (
            <span className="listing-card-thumb">
              <img src={listing.thumbnail} alt="" loading="lazy" />
            </span>
          ) : (
            <BoxIcon size={64} />
          )}
          <Badge tone={STATUS_TONE[listing.status]}>
            {STATUS_LABELS[listing.status]}
          </Badge>
        </>
      }
      footer={
        <>
          <span>
            <strong>{formatBaht(listing.dailyRate)}</strong> / day
          </span>
          <ButtonLink
            size="small"
            to={`/listings/${listing.id}`}
            aria-label={`View ${listing.title}`}
          >
            View details
          </ButtonLink>
        </>
      }
    >
      <h3>{listing.title}</h3>
      <p>{CATEGORY_LABELS[listing.category]}</p>
      {listing.status === 'DRAFT' && listing.publishError && (
        <p>{listing.publishError}</p>
      )}
      {listing.status === 'REJECTED' && listing.rejectionReason && (
        <p>Reason: {listing.rejectionReason}</p>
      )}
    </Card>
  );
}
