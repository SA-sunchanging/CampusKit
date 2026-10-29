import {
  toAvailabilityResponse,
  toBookingListResponse,
  toBookingResponse,
} from './booking.mapper.js';
import { BookingResponse } from './booking.response.js';

const reply = {
  id: '33333333-3333-4333-8333-333333333333',
  listingId: '11111111-1111-4111-8111-111111111111',
  renterId: '00000000-0000-4000-8000-000000000001',
  ownerId: '00000000-0000-4000-8000-000000000002',
  status: 'DECLINED',
  period: {
    start: '2026-11-01T17:00:00.000Z',
    end: '2026-11-04T17:00:00.000Z',
  },
  terms: { rentalFee: 6000, deposit: 30000, lateFeePerDay: 4000 },
  declineReason: 'Needed it myself',
  expiresAt: '2026-10-30T08:00:00.000Z',
  createdAt: '2026-10-29T08:00:00.000Z',
  updatedAt: '2026-10-29T09:00:00.000Z',
};

describe('toBookingResponse', () => {
  it('copies every field of a full reply', () => {
    const booking = toBookingResponse(reply);
    expect(booking).toBeInstanceOf(BookingResponse);
    expect(booking).toEqual(reply);
  });

  it('restores the defaults the gRPC loader leaves out', () => {
    const booking = toBookingResponse({
      id: reply.id,
      status: 'PENDING',
      terms: { rentalFee: 6000 },
    });
    expect(booking).toMatchObject({
      listingId: '',
      period: { start: '', end: '' },
      terms: { rentalFee: 6000, deposit: 0, lateFeePerDay: 0 },
      declineReason: '',
    });
  });

  it('copies no extra fields', () => {
    const booking = toBookingResponse({
      ...reply,
      lastError: 'secret',
    } as never);
    expect(booking).not.toHaveProperty('lastError');
  });
});

describe('toBookingListResponse', () => {
  it('maps each booking', () => {
    expect(toBookingListResponse({ bookings: [reply] }).bookings).toEqual([
      reply,
    ]);
  });

  it('answers an empty list when the loader leaves the list out', () => {
    expect(toBookingListResponse({})).toEqual({ bookings: [] });
  });
});

describe('toAvailabilityResponse', () => {
  it('keeps true', () => {
    expect(toAvailabilityResponse({ available: true })).toEqual({
      available: true,
    });
  });

  it('reads a left-out flag as false', () => {
    expect(toAvailabilityResponse({})).toEqual({ available: false });
  });
});
