import { useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { onSessionExpired } from '../auth/token.ts';
import { useAuth } from '../auth/useAuth.ts';
import { navFor } from './nav.ts';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // The server rejected the token: ask for a new login, then come back here.
  useEffect(
    () =>
      onSessionExpired(() =>
        navigate('/login', { replace: true, state: { from: location } }),
      ),
    [navigate, location],
  );

  function handleLogout() {
    logout();
    navigate('/', { replace: true });
  }

  return (
    <>
      <header className="app-header">
        <NavLink to="/" className="brand">
          CampusKit
        </NavLink>
        <nav aria-label="Main">
          {navFor(user?.role ?? 'guest').map((item) => (
            <NavLink key={item.to} to={item.to} end>
              {item.label}
            </NavLink>
          ))}
          {user && (
            <button type="button" onClick={handleLogout}>
              Log out
            </button>
          )}
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
    </>
  );
}
