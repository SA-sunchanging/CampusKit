import { api } from './client.ts';

// Notification calls through the gateway (role E). Types follow the gateway's Swagger page
// (tag "notification"). Times are ISO-8601 UTC.

/** One notice in the caller's inbox, built from a domain event. */
export interface InboxEntry {
  eventId: string;
  /** Dotted event name, for example 'booking.confirmed'. */
  type: string;
  occurredAt: string;
  /** The event's data; its shape depends on the type. */
  data: Record<string, unknown>;
  read: boolean;
  /** Empty while unread. */
  readAt: string;
}

export interface Inbox {
  /** Newest first, at most 50. */
  entries: InboxEntry[];
  /** Unread notices in the whole inbox, not only in these entries. */
  unread: number;
}

/** The path that marks one notice read. */
export function readPath(eventId: string): string {
  return `/notification/inbox/${encodeURIComponent(eventId)}/read`;
}

export function listInbox(): Promise<Inbox> {
  return api('/notification/inbox');
}

export async function unreadCount(): Promise<number> {
  const body = await api<{ unread: number }>(
    '/notification/inbox/unread-count',
  );
  return body.unread;
}

/** Marking a notice that is already read changes nothing. */
export function markRead(eventId: string): Promise<InboxEntry> {
  return api(readPath(eventId), { method: 'POST' });
}

/** The answer is the new unread count, 0. */
export async function markAllRead(): Promise<number> {
  const body = await api<{ unread: number }>('/notification/inbox/read-all', {
    method: 'POST',
  });
  return body.unread;
}
