import type { RouteObject } from 'react-router';
import RequireAuth from '../../auth/RequireAuth.tsx';
import ReviewsPage from './ReviewsPage.tsx';

export const reviewRoutes: RouteObject[] = [
  {
    path: 'reviews',
    element: (
      <RequireAuth role="student">
        <ReviewsPage />
      </RequireAuth>
    ),
  },
];
