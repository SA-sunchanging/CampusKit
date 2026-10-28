import type { ListingSummary } from '../../api/listing.ts';
import {
  Badge,
  BoxIcon,
  ButtonLink,
  Card,
  formatBaht,
} from '../../ui/index.ts';
import { CATEGORY_LABELS, CONDITION_LABELS, PICKUP_LABELS } from './options.ts';

// One search result (role B), following the card pattern at /ui-preview.
export default function ListingCard({ listing }: { listing: ListingSummary }) {
  const [firstPickup, ...otherPickups] = listing.pickupLocations;
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
          <Badge>{CATEGORY_LABELS[listing.category]}</Badge>
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
            View
          </ButtonLink>
        </>
      }
    >
      <h3>{listing.title}</h3>
      <p>
        {firstPickup && PICKUP_LABELS[firstPickup]}
        {otherPickups.length > 0 && ` +${otherPickups.length} more`} -{' '}
        {listing.ownerName}
      </p>
      <p>
        {CONDITION_LABELS[listing.condition]} - deposit{' '}
        {formatBaht(listing.deposit)}
      </p>
    </Card>
  );
}
