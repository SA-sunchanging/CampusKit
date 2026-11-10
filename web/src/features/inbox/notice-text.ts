import type { InboxEntry } from '../../api/notification.ts';
// The helpers' own file keeps this module free of components, so its spec runs without a DOM.
import { formatBaht, formatDateRange } from '../../ui/format.ts';

// Turns an inbox entry into the text a student reads (role E). The data comes from
// another service's event, so every field is checked before it is used.
export interface NoticeText {
  title: string;
  body: string;
  /** A page in this app where the student can act on the notice. */
  link?: string;
}

type Data = Record<string, unknown>;
type Describe = (data: Data, asOwner: boolean) => NoticeText;

function text(data: Data, key: string): string {
  const value = data[key];
  return typeof value === 'string' ? value : '';
}

function isTime(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

/** " for 1 Nov - 3 Nov 2026", or nothing when the period is missing or invalid. */
function forPeriod(data: Data): string {
  const period = data.period;
  if (typeof period !== 'object' || period === null) return '';
  const { start, end } = period as Data;
  return isTime(start) && isTime(end)
    ? ` for ${formatDateRange(start, end)}`
    : '';
}

function lateFeeNote(data: Data): string {
  const fee = data.lateFee;
  return typeof fee === 'number' && Number.isFinite(fee) && fee > 0
    ? ` A late fee of ${formatBaht(fee)} was taken from the deposit.`
    : '';
}

/** " Reason: ...", or nothing when the event carries no reason. */
function reasonNote(data: Data): string {
  const reason = text(data, 'reason').trim();
  return reason ? ` Reason: ${reason}` : '';
}

function listingLink(data: Data): string | undefined {
  const id = text(data, 'listingId');
  return id ? `/listings/${encodeURIComponent(id)}` : undefined;
}

function rentalLink(data: Data, asOwner: boolean): string {
  const id = text(data, 'rentalId');
  return id
    ? `/rentals/${encodeURIComponent(id)}`
    : `/rentals?role=${asOwner ? 'owner' : 'renter'}`;
}

const DESCRIBE = new Map<string, Describe>(
  Object.entries({
    'booking.requested': (data) => ({
      title: 'New booking request',
      body: `A student asked to rent your item${forPeriod(data)}. Approve or decline it in Bookings.`,
      link: '/bookings?role=owner',
    }),
    'booking.declined': (data) => ({
      title: 'Booking declined',
      body: `The owner declined your request${forPeriod(data)}.`,
      link: '/bookings?role=renter',
    }),
    'booking.confirmed': (data, asOwner) => ({
      title: 'Booking confirmed',
      body: asOwner
        ? `You approved a booking${forPeriod(data)}. Give the renter your pickup code when you hand the item over.`
        : `The owner approved your booking${forPeriod(data)}. Collect the item with the owner's pickup code.`,
      link: `/rentals?role=${asOwner ? 'owner' : 'renter'}`,
    }),
    'booking.failed': (data, asOwner) => ({
      title: 'Booking not completed',
      body: asOwner
        ? `Your approval of the booking${forPeriod(data)} could not be completed, so the booking is not confirmed.`
        : `Your booking${forPeriod(data)} could not be completed, so it is not confirmed. You can request the item again.`,
      link: `/bookings?role=${asOwner ? 'owner' : 'renter'}`,
    }),
    'booking.expired': (data, asOwner) => ({
      title: 'Booking request expired',
      body: asOwner
        ? `A request${forPeriod(data)} expired before you answered it, so the dates are free again.`
        : `The owner did not answer your request${forPeriod(data)} in time. You can request the item again.`,
      link: `/bookings?role=${asOwner ? 'owner' : 'renter'}`,
    }),
    'booking.cancelled': (data, asOwner) => ({
      title: 'Booking cancelled',
      body: `The booking${forPeriod(data)} was cancelled before pickup, so the dates are free again.${reasonNote(data)}`,
      link: `/bookings?role=${asOwner ? 'owner' : 'renter'}`,
    }),
    'listing.published': (data) => {
      const title = text(data, 'title');
      return {
        title: 'Listing published',
        body: title
          ? `"${title}" is now open for booking.`
          : 'Your listing is now open for booking.',
        link: listingLink(data),
      };
    },
    'listing.rejected': (data) => {
      const title = text(data, 'title');
      return {
        title: 'Listing not approved',
        body:
          (title
            ? `An administrator did not approve "${title}", so it is not published.`
            : 'An administrator did not approve your listing, so it is not published.') +
          reasonNote(data),
        link: listingLink(data),
      };
    },
    'rental.started': (data, asOwner) => ({
      title: 'Rental started',
      body: asOwner
        ? `The renter picked up your item${forPeriod(data)}.`
        : `You picked up the item${forPeriod(data)}. Return it on time to avoid a late fee.`,
      link: rentalLink(data, asOwner),
    }),
    'rental.reminded': (data, asOwner) => ({
      title: 'Return due soon',
      body: `Your rental${forPeriod(data)} ends within a day. Return the item on time to avoid a late fee.`,
      link: rentalLink(data, asOwner),
    }),
    'rental.overdue': (data, asOwner) => ({
      title: 'Rental overdue',
      body: asOwner
        ? `The rental${forPeriod(data)} has ended and your item is not back yet. A late fee applies for each started day.`
        : `The rental${forPeriod(data)} has ended. Return the item now; a late fee applies for each started day.`,
      link: rentalLink(data, asOwner),
    }),
    'rental.closed': (data, asOwner) => ({
      title: 'Rental closed',
      body:
        (asOwner
          ? `Your item is back and the rental${forPeriod(data)} is settled.`
          : `You returned the item and the rental${forPeriod(data)} is settled.`) +
        lateFeeNote(data),
      link: rentalLink(data, asOwner),
    }),
    'identity.verified': () => ({
      title: 'Student status verified',
      body: 'An administrator verified your student status. You can now book and list items.',
      link: '/account',
    }),
  } satisfies Record<string, Describe>),
);

/** The viewer is the owner when the event names them as the owner; otherwise the renter. */
export function describeNotice(
  entry: Pick<InboxEntry, 'type' | 'data'>,
  viewerId: string,
): NoticeText {
  const data: Data =
    typeof entry.data === 'object' && entry.data !== null ? entry.data : {};
  const describe = DESCRIBE.get(entry.type);
  if (!describe) {
    return {
      title: 'Update',
      body: entry.type
        ? `Something changed (${entry.type}).`
        : 'Something changed.',
    };
  }
  const ownerId = text(data, 'ownerId');
  return describe(
    data,
    ownerId !== '' && ownerId.toLowerCase() === viewerId.toLowerCase(),
  );
}
