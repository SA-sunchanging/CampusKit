import type { Tone } from '../../ui/index.ts';

// Sample data for the preview page only. Shapes follow the shared conventions
// (satang, ISO-8601 UTC, half-open date ranges); real types live in web/src/api.
export interface SampleListing {
  id: string;
  title: string;
  category: string;
  campus: string;
  owner: string;
  feePerDaySatang: number;
  depositSatang: number;
  rating: number;
}

export interface SampleBooking {
  id: string;
  listing: string;
  start: string;
  end: string;
  status: string;
  tone: Tone;
}

export interface SampleNotice {
  id: string;
  title: string;
  body: string;
  at: string;
  unread: boolean;
}

export const LISTINGS: SampleListing[] = [
  {
    id: 'l1',
    title: 'Calculus I textbook, 8th edition',
    category: 'Books',
    campus: 'Faculty of Engineering',
    owner: 'Sample Owner A',
    feePerDaySatang: 2000,
    depositSatang: 30000,
    rating: 4.8,
  },
  {
    id: 'l2',
    title: 'Badminton racket with case',
    category: 'Sports',
    campus: 'Sports Complex',
    owner: 'Sample Owner B',
    feePerDaySatang: 3550,
    depositSatang: 50000,
    rating: 4.5,
  },
  {
    id: 'l3',
    title: 'Graduation gown, size M',
    category: 'Clothing',
    campus: 'Faculty of Arts',
    owner: 'Sample Owner C',
    feePerDaySatang: 15000,
    depositSatang: 100000,
    rating: 5,
  },
];

export const BOOKINGS: SampleBooking[] = [
  {
    id: 'b1',
    listing: 'Calculus I textbook, 8th edition',
    start: '2026-10-31T17:00:00Z',
    end: '2026-11-02T17:00:00Z',
    status: 'REQUESTED',
    tone: 'neutral',
  },
  {
    id: 'b2',
    listing: 'Badminton racket with case',
    start: '2026-11-04T17:00:00Z',
    end: '2026-11-06T17:00:00Z',
    status: 'CONFIRMED',
    tone: 'success',
  },
  {
    id: 'b3',
    listing: 'Graduation gown, size M',
    start: '2026-11-09T17:00:00Z',
    end: '2026-11-10T17:00:00Z',
    status: 'DECLINED',
    tone: 'danger',
  },
];

export const NOTICES: SampleNotice[] = [
  {
    id: 'n1',
    title: 'Booking confirmed',
    body: 'Your booking for the badminton racket is confirmed.',
    at: '2026-10-28T03:15:00Z',
    unread: true,
  },
  {
    id: 'n2',
    title: 'Return reminder',
    body: 'Please return the Calculus textbook tomorrow.',
    at: '2026-10-27T10:00:00Z',
    unread: true,
  },
  {
    id: 'n3',
    title: 'Review received',
    body: 'A borrower left you a 5-star review.',
    at: '2026-10-25T08:40:00Z',
    unread: false,
  },
];
