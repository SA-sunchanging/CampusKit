import type { RouteObject } from 'react-router';
import ListingsPage from './ListingsPage.tsx';

// Listings are public, so guests can browse before they register.
export const listingRoutes: RouteObject[] = [
  { index: true, element: <ListingsPage /> },
];
