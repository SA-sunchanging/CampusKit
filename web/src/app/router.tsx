import { createBrowserRouter, Navigate } from 'react-router';
import { accountRoutes } from '../features/account/routes.tsx';
import { adminRoutes } from '../features/admin/routes.tsx';
import { bookingRoutes } from '../features/booking/routes.tsx';
import { inboxRoutes } from '../features/inbox/routes.tsx';
import { listingRoutes } from '../features/listing/routes.tsx';
import { rentalRoutes } from '../features/rental/routes.tsx';
import { reviewRoutes } from '../features/review/routes.tsx';
import Layout from './Layout.tsx';

// Each feature owns its routes in features/<name>/routes.tsx; this file only combines them.
export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      ...listingRoutes,
      ...accountRoutes,
      ...bookingRoutes,
      ...rentalRoutes,
      ...inboxRoutes,
      ...reviewRoutes,
      ...adminRoutes,
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
