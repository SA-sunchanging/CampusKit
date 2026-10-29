import type { Inbox, InboxEntry } from '../../api/notification.ts';

// Local inbox updates after a mark action (role E), so the page does not reload the list.

/** Swaps in the server's copy of a notice; the count drops only if it was unread here. */
export function withEntryRead(inbox: Inbox, updated: InboxEntry): Inbox {
  const before = inbox.entries.find(
    (entry) => entry.eventId === updated.eventId,
  );
  const dropped = before && !before.read && updated.read ? 1 : 0;
  return {
    entries: inbox.entries.map((entry) =>
      entry.eventId === updated.eventId ? updated : entry,
    ),
    unread: Math.max(0, inbox.unread - dropped),
  };
}

/** Every notice read at `readAt`, with the count the server returned. */
export function withAllRead(
  inbox: Inbox,
  unread: number,
  readAt: string,
): Inbox {
  return {
    entries: inbox.entries.map((entry) =>
      entry.read ? entry : { ...entry, read: true, readAt },
    ),
    unread,
  };
}
