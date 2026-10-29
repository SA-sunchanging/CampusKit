import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { unreadCount } from '../../api/notification.ts';
import { useAuth } from '../../auth/useAuth.ts';
import { INBOX_CHANGED } from './inboxChanged.ts';

// The unread count for the nav badge (role E).
export { INBOX_CHANGED };

/** How often the count is fetched while a page stays open. */
export const UNREAD_POLL_MS = 30_000;

/** '' hides the badge; large counts are capped so the nav keeps its width. */
export function badgeLabel(count: number): string {
  if (!Number.isFinite(count) || count < 1) return '';
  return count > 99 ? '99+' : String(Math.floor(count));
}

/**
 * The logged-in student's unread count; 0 for anyone else. Fetched on mount, every
 * UNREAD_POLL_MS, on each route change, and on INBOX_CHANGED. A failed fetch keeps the
 * last value: the badge is a hint, and the inbox page reports errors itself.
 */
export function useUnreadCount(): number {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const userId = user?.role === 'student' ? user.id : '';
  const [tick, setTick] = useState(0);
  const [known, setKnown] = useState({ userId: '', count: 0 });

  useEffect(() => {
    if (!userId) return;
    const refresh = () => setTick((n) => n + 1);
    const timer = setInterval(refresh, UNREAD_POLL_MS);
    window.addEventListener(INBOX_CHANGED, refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener(INBOX_CHANGED, refresh);
    };
  }, [userId]);

  // tick and pathname only trigger a new fetch; a newer fetch makes the older one stale.
  useEffect(() => {
    if (!userId) return;
    let active = true;
    unreadCount()
      .then((count) => active && setKnown({ userId, count }))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [userId, pathname, tick]);

  // A count fetched for an earlier login is not shown to the next one.
  return userId && known.userId === userId ? known.count : 0;
}
