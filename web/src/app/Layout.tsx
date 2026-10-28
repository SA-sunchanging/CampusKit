import { useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { onSessionExpired, type Role } from '../auth/token.ts';
import { useAuth } from '../auth/useAuth.ts';
import { BagIcon, Button } from '../ui/index.ts';
import { navFor } from './nav.ts';

const ROLE_LABEL: Record<Role, string> = {
  student: 'Student',
  admin: 'Administrator',
};

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

  // Leave the page first: logging out on a guarded page would make its guard
  // redirect to /login before the navigation to home commits.
  async function handleLogout() {
    await navigate('/', { replace: true });
    logout();
  }

  return (
    <>
      <header className="app-header">
        <NavLink to="/" className="brand">
          <span className="brand-icon">
            <BagIcon size={22} />
          </span>
          CampusKit
          <span className="brand-caption">BORROW A LITTLE, DO A LOT</span>
        </NavLink>
        {user && (
          <div className="account">
            <span>
              Logged in
              <small>{ROLE_LABEL[user.role]}</small>
            </span>
            <Button
              variant="ghost"
              size="small"
              onClick={() => void handleLogout()}
            >
              Log out
            </Button>
          </div>
        )}
      </header>
      <div className="page">
        <nav className="main-nav" aria-label="Main">
          {navFor(user?.role ?? 'guest').map((item) => (
            <NavLink key={item.to} to={item.to} end>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <main>
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>CampusKit - peer-to-peer rentals for Chula students</span>
          <span>2110521 Software Architecture, 2026</span>
        </footer>
      </div>
    </>
  );
}
