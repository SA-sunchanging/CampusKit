import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { canAccess, type Requirement } from '../app/nav.ts';
import { useAuth } from './useAuth.ts';

// Route guard. It only improves the UI; the services still check every call.
export default function RequireAuth({
  role = 'user',
  children,
}: {
  role?: Requirement;
  children: ReactNode;
}) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) {
    // Remember where the guest was going so login can return there.
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (!canAccess(user.role, role)) return <Navigate to="/" replace />;
  return children;
}
