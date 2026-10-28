import type { RouteObject } from 'react-router';
import RequireAuth from '../../auth/RequireAuth.tsx';
import CreateListingPage from './CreateListingPage.tsx';
import ListingDetailPage from './ListingDetailPage.tsx';
import ListingsPage from './ListingsPage.tsx';

// Listings are public, so guests can browse before they register. Only creating
// a listing needs a student login. React Router ranks the static "listings/new"
// above "listings/:id", so the order here does not matter.
export const listingRoutes: RouteObject[] = [
  { index: true, element: <ListingsPage /> },
  {
    path: 'listings/new',
    element: (
      <RequireAuth role="student">
        <CreateListingPage />
      </RequireAuth>
    ),
  },
  { path: 'listings/:id', element: <ListingDetailPage /> },
];
