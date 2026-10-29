import type { RouteObject } from 'react-router';
import RequireAuth from '../../auth/RequireAuth.tsx';
import RentalDetailPage from './RentalDetailPage.tsx';
import RentalsPage from './RentalsPage.tsx';

export const rentalRoutes: RouteObject[] = [
  {
    path: 'rentals',
    element: (
      <RequireAuth role="student">
        <RentalsPage />
      </RequireAuth>
    ),
  },
  {
    path: 'rentals/:id',
    element: (
      <RequireAuth role="student">
        <RentalDetailPage />
      </RequireAuth>
    ),
  },
];
