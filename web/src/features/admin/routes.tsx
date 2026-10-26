import type { RouteObject } from 'react-router';
import RequireAuth from '../../auth/RequireAuth.tsx';
import AdminPage from './AdminPage.tsx';

export const adminRoutes: RouteObject[] = [
  {
    path: 'admin',
    element: (
      <RequireAuth role="admin">
        <AdminPage />
      </RequireAuth>
    ),
  },
];
