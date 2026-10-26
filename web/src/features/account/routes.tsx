import type { RouteObject } from 'react-router';
import RequireAuth from '../../auth/RequireAuth.tsx';
import AccountPage from './AccountPage.tsx';
import LoginPage from './LoginPage.tsx';
import RegisterPage from './RegisterPage.tsx';

export const accountRoutes: RouteObject[] = [
  { path: 'login', element: <LoginPage /> },
  { path: 'register', element: <RegisterPage /> },
  {
    path: 'account',
    element: (
      <RequireAuth>
        <AccountPage />
      </RequireAuth>
    ),
  },
];
