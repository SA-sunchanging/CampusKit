import {
  Badge,
  BoxIcon,
  Button,
  Card,
  Field,
  formatBaht,
  PageHeader,
  Panel,
  StarIcon,
} from '../../ui/index.ts';
import { LISTINGS } from './samples.ts';

// Search panel and listing cards (pattern for role B).
export default function ListingPreview() {
  return (
    <section>
      <PageHeader title="Listings" aside="Role B pattern" />
      <Panel>
        <form className="stack" onSubmit={(event) => event.preventDefault()}>
          <Field label="Keyword">
            <input placeholder="Textbook, racket, gown..." />
          </Field>
          <Field label="Category">
            <select defaultValue="">
              <option value="">All categories</option>
              <option>Books</option>
              <option>Sports</option>
              <option>Clothing</option>
            </select>
          </Field>
          <div className="actions">
            <Button type="submit">Search</Button>
          </div>
        </form>
      </Panel>
      <div className="grid">
        {LISTINGS.map((listing) => (
          <Card
            key={listing.id}
            media={
              <>
                <Badge>{listing.category}</Badge>
                <BoxIcon size={64} />
              </>
            }
            footer={
              <>
                <span>
                  <strong>{formatBaht(listing.feePerDaySatang)}</strong> / day
                </span>
                <Button size="small">View</Button>
              </>
            }
          >
            <h3>{listing.title}</h3>
            <p>
              {listing.campus} - {listing.owner}
            </p>
            <p>
              <StarIcon size={14} /> {listing.rating.toFixed(1)} - deposit{' '}
              {formatBaht(listing.depositSatang)}
            </p>
          </Card>
        ))}
      </div>
    </section>
  );
}
