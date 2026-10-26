import type { RouteObject } from 'react-router';
import RequireAuth from '../../auth/RequireAuth.tsx';
import BookingsPage from './BookingsPage.tsx';

export const bookingRoutes: RouteObject[] = [
  {
    path: 'bookings',
    element: (
      <RequireAuth role="student">
        <BookingsPage />
      </RequireAuth>
    ),
  },
];
