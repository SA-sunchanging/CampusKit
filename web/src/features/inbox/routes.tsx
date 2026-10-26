import type { RouteObject } from 'react-router';
import RequireAuth from '../../auth/RequireAuth.tsx';
import InboxPage from './InboxPage.tsx';

export const inboxRoutes: RouteObject[] = [
  {
    path: 'inbox',
    element: (
      <RequireAuth role="student">
        <InboxPage />
      </RequireAuth>
    ),
  },
];
