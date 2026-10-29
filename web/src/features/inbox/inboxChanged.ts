// A window event that says the unread count may have changed (role E). The inbox page
// fires it after a mark action; the navigation badge listens and fetches the count again.
export const INBOX_CHANGED = 'inbox:changed';

export function announceInboxChanged(): void {
  window.dispatchEvent(new Event(INBOX_CHANGED));
}
