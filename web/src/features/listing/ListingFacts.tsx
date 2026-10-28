import type { Listing } from '../../api/listing.ts';
import { formatBaht, formatDateRange, Panel } from '../../ui/index.ts';
import { PICKUP_LABELS } from './options.ts';

// Price box and item details on the listing detail page (role B).
export function PriceBox({ listing }: { listing: Listing }) {
  const days = listing.maxRentalDays;
  return (
    <Panel title="Price">
      <dl>
        <dt>Daily rate</dt>
        <dd>
          <strong>{formatBaht(listing.dailyRate)}</strong> / day
        </dd>
        <dt>Deposit</dt>
        <dd>{formatBaht(listing.deposit)}</dd>
        <dt>Late fee</dt>
        <dd>{formatBaht(listing.lateFeePerDay)} / day late</dd>
        <dt>Longest rental</dt>
        <dd>{days === 1 ? '1 day' : `${days} days`}</dd>
        <dt>Replacement value</dt>
        <dd>{formatBaht(listing.replacementValue)}</dd>
      </dl>
    </Panel>
  );
}

export function ItemDetails({ listing }: { listing: Listing }) {
  return (
    <Panel title="About this item">
      <p className="listing-description">{listing.description}</p>
      <h3>Accessories</h3>
      {listing.accessories.length > 0 ? (
        <ul>
          {listing.accessories.map((item, index) => (
            <li key={`${index}-${item}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <p>No accessories listed.</p>
      )}
      <h3>Pickup locations</h3>
      <ul>
        {listing.pickupLocations.map((location) => (
          <li key={location}>{PICKUP_LABELS[location]}</li>
        ))}
      </ul>
      <h3>Unavailable periods</h3>
      {listing.blackouts.length > 0 ? (
        <>
          <ul>
            {listing.blackouts.map((range) => (
              <li key={range.start}>
                {formatDateRange(range.start, range.end)}
              </li>
            ))}
          </ul>
          <p>Each period ends on the day the item is available again.</p>
        </>
      ) : (
        <p>The owner has not blocked any dates.</p>
      )}
    </Panel>
  );
}
