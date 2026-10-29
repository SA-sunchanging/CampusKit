import { badgeLabel, useUnreadCount } from './useUnreadCount.ts';
import './inbox.css';
import './nav-count.css';

// The unread count inside the Inbox nav link (role E). Screen readers hear
// "Inbox, 3 unread"; the capped label ("99+") is only shown.
export default function UnreadBadge() {
  const count = useUnreadCount();
  const label = badgeLabel(count);
  if (!label) return null;
  return (
    <span className="inbox-count">
      <span aria-hidden="true">{label}</span>
      <span className="inbox-sr">, {count} unread</span>
    </span>
  );
}
