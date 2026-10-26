import type { RouteObject } from 'react-router';
import RequireAuth from '../../auth/RequireAuth.tsx';
import AccountPage from './AccountPage.tsx';

export const accountRoutes: RouteObject[] = [
  {
    path: 'account',
    element: (
      <RequireAuth>
        <AccountPage />
      </RequireAuth>
    ),
  },
];
