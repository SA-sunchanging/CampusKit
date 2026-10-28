import {
  Badge,
  Button,
  CalendarIcon,
  formatBaht,
  formatDateRange,
  PageHeader,
  Panel,
} from '../../ui/index.ts';
import { BOOKINGS } from './samples.ts';

// Booking rows (role C) and a rental with codes and payment (role D).
export default function FlowPreview() {
  return (
    <section>
      <PageHeader title="Bookings and rentals" aside="Roles C and D pattern" />
      <Panel title="My bookings">
        {BOOKINGS.map((booking) => (
          <div className="row" key={booking.id}>
            <span className="row-icon">
              <CalendarIcon />
            </span>
            <div className="row-main">
              <h3>{booking.listing}</h3>
              <p>{formatDateRange(booking.start, booking.end)}</p>
            </div>
            <Badge tone={booking.tone}>{booking.status}</Badge>
          </div>
        ))}
      </Panel>
      <Panel title="Rental">
        <div className="stack">
          <p>
            Badminton racket with case -{' '}
            {formatDateRange(BOOKINGS[1].start, BOOKINGS[1].end)}
          </p>
          <div className="actions">
            <Badge tone="warning">AWAITING_PICKUP</Badge>
            <Badge tone="success">Fee authorized</Badge>
          </div>
          <p>Show this pickup code to the owner:</p>
          <span className="code">482 913</span>
          <dl>
            <dt>Fee</dt>
            <dd>{formatBaht(7100)}</dd>
            <dt>Deposit held</dt>
            <dd>{formatBaht(50000)}</dd>
          </dl>
          <div className="actions">
            <Button>Confirm pickup</Button>
            <Button variant="ghost">Cancel booking</Button>
          </div>
        </div>
      </Panel>
    </section>
  );
}
