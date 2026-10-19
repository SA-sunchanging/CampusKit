import { useState } from 'react';
import AccountPage from '../features/account/AccountPage.tsx';
import ListingsPage from '../features/listing/ListingsPage.tsx';
import BookingsPage from '../features/booking/BookingsPage.tsx';
import RentalsPage from '../features/rental/RentalsPage.tsx';
import InboxPage from '../features/inbox/InboxPage.tsx';
import ReviewsPage from '../features/review/ReviewsPage.tsx';
import AdminPage from '../features/admin/AdminPage.tsx';

// App shell (role A). Replace this simple tab switch with a router when the pages need URLs.
const pages = [
  { label: 'Account', Page: AccountPage },
  { label: 'Listings', Page: ListingsPage },
  { label: 'Bookings', Page: BookingsPage },
  { label: 'Rentals', Page: RentalsPage },
  { label: 'Inbox', Page: InboxPage },
  { label: 'Reviews', Page: ReviewsPage },
  { label: 'Admin', Page: AdminPage },
];

export default function App() {
  const [current, setCurrent] = useState(0);
  const { Page } = pages[current];
  return (
    <main>
      <h1>CampusKit</h1>
      <nav aria-label="Sections">
        {pages.map((page, index) => (
          <button
            key={page.label}
            type="button"
            aria-pressed={index === current}
            onClick={() => setCurrent(index)}
          >
            {page.label}
          </button>
        ))}
      </nav>
      <Page />
    </main>
  );
}
