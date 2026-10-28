import { BadRequestException } from '@nestjs/common';
import { isBangkokMidnight } from '../listings/blackouts.js';
import type { Listing } from '../listings/listing.entity.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface Quote {
  listingId: string;
  ownerId: string;
  days: number;
  rentalFee: number;
  deposit: number;
  lateFeePerDay: number;
}

type QuoteFields = Pick<
  Listing,
  'id' | 'ownerId' | 'dailyRate' | 'deposit' | 'lateFeePerDay' | 'maxRentalDays'
>;

/**
 * Prices a rental of whole Bangkok days [start, end): the daily rate times the days, plus the
 * deposit and late fee the owner set. There is no platform fee. Whether the dates are in the
 * future or free is Booking's check, not this one.
 */
export function quoteFor(listing: QuoteFields, start: Date, end: Date): Quote {
  if (!isBangkokMidnight(start) || !isBangkokMidnight(end)) {
    throw new BadRequestException(
      'start and end must be midnight in Bangkok (17:00 UTC)',
    );
  }
  const days = (end.getTime() - start.getTime()) / DAY_MS;
  if (days < 1) {
    throw new BadRequestException('end must be at least one day after start');
  }
  if (days > listing.maxRentalDays) {
    throw new BadRequestException(
      `This item can be rented for at most ${listing.maxRentalDays} days`,
    );
  }
  return {
    listingId: listing.id,
    ownerId: listing.ownerId,
    days,
    rentalFee: listing.dailyRate * days,
    deposit: listing.deposit,
    lateFeePerDay: listing.lateFeePerDay,
  };
}
