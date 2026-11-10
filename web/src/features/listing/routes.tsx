import type { RouteObject } from 'react-router';
import RequireAuth from '../../auth/RequireAuth.tsx';
import CreateListingPage from './CreateListingPage.tsx';
import ListingDetailPage from './ListingDetailPage.tsx';
import ListingsPage from './ListingsPage.tsx';
import MyListingsPage from './MyListingsPage.tsx';

// Public browsing; creation and the owner's catalogue require a student login.
// React Router ranks static paths above "listings/:id".
export const listingRoutes: RouteObject[] = [
  { index: true, element: <ListingsPage /> },
  {
    path: 'listings/mine',
    element: (
      <RequireAuth role="student">
        <MyListingsPage />
      </RequireAuth>
    ),
  },
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
