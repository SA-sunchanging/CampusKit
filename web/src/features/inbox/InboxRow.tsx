import { Link } from 'react-router';
import type { InboxEntry } from '../../api/notification.ts';
import { BellIcon, Button, formatDate } from '../../ui/index.ts';
import { describeNotice } from './notice-text.ts';

interface InboxRowProps {
  entry: InboxEntry;
  viewerId: string;
  /** True while a mark action is running. */
  busy: boolean;
  onRead: () => void;
}

// One notice. Unread notices get a dot, a bold title, and a "Mark as read" button.
export default function InboxRow({
  entry,
  viewerId,
  busy,
  onRead,
}: InboxRowProps) {
  const notice = describeNotice(entry, viewerId);
  const unread = !entry.read;
  return (
    <div className={unread ? 'row inbox-row is-unread' : 'row inbox-row'}>
      <span className="row-icon">
        <BellIcon />
      </span>
      <div className="row-main">
        <h3>
          {unread && <span className="inbox-dot" aria-hidden="true" />}
          {unread && <span className="inbox-sr">Unread: </span>}
          {notice.link ? (
            <Link to={notice.link}>{notice.title}</Link>
          ) : (
            notice.title
          )}
        </h3>
        <p>{notice.body}</p>
        <small>{noticeDate(entry.occurredAt)}</small>
      </div>
      {unread && (
        <Button variant="ghost" size="small" disabled={busy} onClick={onRead}>
          Mark as read
        </Button>
      )}
    </div>
  );
}

// formatDate throws on an invalid time; show nothing instead.
function noticeDate(iso: string): string {
  return Number.isNaN(Date.parse(iso)) ? '' : formatDate(iso);
}
