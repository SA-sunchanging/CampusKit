import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { getRental, type Rental } from '../../api/rental.ts';
import { useAuth } from '../../auth/useAuth.ts';
import { Alert, Badge, EmptyState, PageHeader } from '../../ui/index.ts';
import { useListingTitles } from '../booking/useListingTitles.ts';
import ReviewPanel from '../review/ReviewPanel.tsx';
import EvidenceSection from './evidence/EvidenceSection.tsx';
import NextStep from './NextStep.tsx';
import PaymentStatusPanel from './PaymentStatusPanel.tsx';
import RentalFacts from './RentalFacts.tsx';
import { statusLabel, statusTone } from './status.ts';
import { usePayments } from './usePayments.ts';
import './rental.css';

// The service rejects ids that are not UUIDs, so such a link is simply not found.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Loaded {
  /** The rental id this answer is for. */
  id: string;
  rental?: Rental;
  error?: string;
}

// One rental (role D), for its renter or its owner: the code, the handover and the payments.
export default function RentalDetailPage() {
  const { id = '' } = useParams();
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (!UUID.test(id)) return;
    let active = true;
    getRental(id)
      .then((rental) => active && setLoaded({ id, rental }))
      .catch((err: Error) => active && setLoaded({ id, error: err.message }));
    return () => {
      active = false;
    };
  }, [id]);

  const current = loaded?.id === id ? loaded : null;
  // The API client keeps only the message, so a 404 is recognised by its text.
  if (!UUID.test(id) || (current?.error && /not found/i.test(current.error))) {
    return (
      <EmptyState title="Rental not found">
        Only the renter and the owner can open a rental.{' '}
        <Link to="/rentals">Back to rentals</Link>
      </EmptyState>
    );
  }
  if (!current) return <p>Loading rental...</p>;
  if (!current.rental) {
    return (
      <section className="stack">
        <Alert tone="danger">{current.error}</Alert>
        <p>
          <Link to="/rentals">Back to rentals</Link>
        </p>
      </section>
    );
  }
  return (
    <RentalView
      key={current.rental.id}
      rental={current.rental}
      onChange={(rental) => setLoaded({ id, rental })}
    />
  );
}

function RentalView({
  rental,
  onChange,
}: {
  rental: Rental;
  onChange: (rental: Rental) => void;
}) {
  const { user } = useAuth();
  const [version, setVersion] = useState(0);
  const payments = usePayments(rental.bookingId, version);
  const title = useListingTitles([rental.listingId])[rental.listingId];

  // A step moves money, so the payment status is read again after it.
  function change(next: Rental) {
    onChange(next);
    setVersion((current) => current + 1);
  }

  return (
    <section>
      <p className="rental-back">
        <Link to="/rentals">Back to rentals</Link>
      </p>
      <PageHeader
        title={title ?? 'Rental'}
        aside={
          <span className="rental-badges">
            <Badge tone={statusTone(rental.status)}>
              {statusLabel(rental.status)}
            </Badge>
            {rental.overdue && <Badge tone="danger">Overdue</Badge>}
          </span>
        }
      />
      <div className="rental-detail">
        <div className="rental-detail-main">
          <EvidenceSection rental={rental} viewerId={user?.id ?? ''} />
          <NextStep
            rental={rental}
            viewerId={user?.id ?? ''}
            onChange={change}
          />
          <RentalFacts rental={rental} />
          <ReviewPanel rental={rental} viewerId={user?.id ?? ''} />
        </div>
        <PaymentStatusPanel loaded={payments} />
      </div>
    </section>
  );
}
