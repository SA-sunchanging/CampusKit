import { useEffect, useState } from 'react';
import {
  type Inbox,
  listInbox,
  markAllRead,
  markRead,
} from '../../api/notification.ts';
import { useAuth } from '../../auth/useAuth.ts';
import {
  Alert,
  Badge,
  BellIcon,
  Button,
  EmptyState,
  PageHeader,
  Panel,
} from '../../ui/index.ts';
import { announceInboxChanged } from './inboxChanged.ts';
import { withAllRead, withEntryRead } from './inboxState.ts';
import InboxRow from './InboxRow.tsx';
import './inbox.css';

interface Loaded {
  inbox?: Inbox;
  error?: string;
}

/** The notice being marked, ALL for "Mark all as read", or null when idle. */
const ALL = 'all';

// The student's in-app notifications (role E), newest first.
export default function InboxPage() {
  const { user } = useAuth();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    let active = true;
    listInbox()
      .then((inbox) => active && setLoaded({ inbox }))
      .catch((err: Error) => active && setLoaded({ error: err.message }));
    return () => {
      active = false;
    };
  }, []);

  // Runs a mark action, applies its result here, and tells the nav badge to refresh.
  async function run(key: string, action: () => Promise<(i: Inbox) => Inbox>) {
    setBusy(key);
    setActionError('');
    try {
      const update = await action();
      setLoaded((current) =>
        current?.inbox ? { inbox: update(current.inbox) } : current,
      );
      announceInboxChanged();
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const readOne = (eventId: string) =>
    run(eventId, async () => {
      const updated = await markRead(eventId);
      return (inbox) => withEntryRead(inbox, updated);
    });

  const readAll = () =>
    run(ALL, async () => {
      const unread = await markAllRead();
      const readAt = new Date().toISOString();
      return (inbox) => withAllRead(inbox, unread, readAt);
    });

  const inbox = loaded?.inbox;
  const unread = inbox?.unread ?? 0;
  return (
    <section>
      <PageHeader
        title="Inbox"
        aside={
          inbox && (
            <div className="inbox-header-aside">
              <Badge tone={unread > 0 ? 'warning' : 'neutral'}>
                {unread} unread
              </Badge>
              {unread > 0 && (
                <Button
                  variant="ghost"
                  size="small"
                  disabled={busy !== null}
                  onClick={() => void readAll()}
                >
                  Mark all as read
                </Button>
              )}
            </div>
          )
        }
      />
      <div className="stack">
        {actionError && <Alert tone="danger">{actionError}</Alert>}
        {!loaded && <p>Loading inbox...</p>}
        {loaded && !inbox && <Alert tone="danger">{loaded.error}</Alert>}
        {inbox && inbox.entries.length === 0 && (
          <EmptyState title="No notices yet" icon={<BellIcon size={32} />}>
            Updates on your bookings, listings, and rentals show here.
          </EmptyState>
        )}
        {inbox && inbox.entries.length > 0 && (
          <Panel>
            {inbox.entries.map((entry) => (
              <InboxRow
                key={entry.eventId}
                entry={entry}
                viewerId={user?.id ?? ''}
                busy={busy !== null}
                onRead={() => void readOne(entry.eventId)}
              />
            ))}
          </Panel>
        )}
      </div>
    </section>
  );
}
