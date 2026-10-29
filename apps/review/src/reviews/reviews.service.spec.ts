import type { AuthUser } from '@app/common';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Types, type Model } from 'mongoose';
import type { RentalClient, RentalView } from '../clients/rental.client.js';
import type { Review } from './review.schema.js';
import { ReviewsService, sidesOf } from './reviews.service.js';

const RENTAL_ID = '11111111-1111-4111-8111-111111111111';
const OWNER_ID = '22222222-2222-4222-8222-222222222222';
const RENTER_ID = '33333333-3333-4333-8333-333333333333';
const LISTING_ID = '44444444-4444-4444-8444-444444444444';
const STRANGER_ID = '55555555-5555-4555-8555-555555555555';
const CREATED_AT = new Date('2026-10-29T08:00:00.000Z');

const closed: RentalView = {
  id: RENTAL_ID,
  listingId: LISTING_ID,
  ownerId: OWNER_ID,
  renterId: RENTER_ID,
  status: 'CLOSED',
};

const as = (sub: string): AuthUser => ({ sub, role: 'student' });

function setup(
  rental: RentalView | Error = closed,
  create: (doc: Record<string, unknown>) => Promise<unknown> = (doc) =>
    Promise.resolve({
      toObject: () => ({
        _id: new Types.ObjectId(),
        ...doc,
        createdAt: CREATED_AT,
      }),
    }),
) {
  const get = vi.fn(() =>
    rental instanceof Error ? Promise.reject(rental) : Promise.resolve(rental),
  );
  const model = { create: vi.fn(create) };
  const service = new ReviewsService(
    model as unknown as Model<Review>,
    { get } as unknown as RentalClient,
  );
  return { service, model, get };
}

describe('sidesOf', () => {
  it('lets the owner review the renter', () => {
    expect(sidesOf(closed, OWNER_ID)).toEqual({
      reviewerRole: 'owner',
      revieweeId: RENTER_ID,
    });
  });

  it('lets the renter review the owner', () => {
    expect(sidesOf(closed, RENTER_ID)).toEqual({
      reviewerRole: 'renter',
      revieweeId: OWNER_ID,
    });
  });

  it('compares IDs in lower case', () => {
    const upper = { ...closed, renterId: RENTER_ID.toUpperCase() };
    expect(sidesOf(upper, OWNER_ID).revieweeId).toBe(RENTER_ID);
  });

  it('refuses anyone else', () => {
    expect(() => sidesOf(closed, STRANGER_ID)).toThrow(ForbiddenException);
  });
});

describe('ReviewsService', () => {
  it('stores the review of the other participant and returns it', async () => {
    const { service, model, get } = setup();
    const review = await service.submit(
      as(RENTER_ID.toUpperCase()),
      { rentalId: RENTAL_ID, rating: 5, comment: 'Great' },
      'corr-1',
    );
    expect(get).toHaveBeenCalledWith(RENTAL_ID, 'corr-1');
    expect(model.create).toHaveBeenCalledWith({
      rentalId: RENTAL_ID,
      listingId: LISTING_ID,
      reviewerId: RENTER_ID,
      reviewerRole: 'renter',
      revieweeId: OWNER_ID,
      rating: 5,
      comment: 'Great',
    });
    expect(review).toMatchObject({
      rentalId: RENTAL_ID,
      revieweeId: OWNER_ID,
      rating: 5,
      comment: 'Great',
      createdAt: CREATED_AT.toISOString(),
    });
  });

  it('answers an empty comment when none was written', async () => {
    const { service } = setup();
    const review = await service.submit(
      as(OWNER_ID),
      { rentalId: RENTAL_ID, rating: 3 },
      'c',
    );
    expect(review.comment).toBe('');
    expect(review.reviewerRole).toBe('owner');
  });

  it('passes on 404 for an unknown rental', async () => {
    const { service, model } = setup(new NotFoundException('Rental not found'));
    await expect(
      service.submit(as(OWNER_ID), { rentalId: RENTAL_ID, rating: 4 }, 'c'),
    ).rejects.toThrow(NotFoundException);
    expect(model.create).not.toHaveBeenCalled();
  });

  it('refuses a caller outside the rental', async () => {
    const { service, model } = setup();
    await expect(
      service.submit(as(STRANGER_ID), { rentalId: RENTAL_ID, rating: 4 }, 'c'),
    ).rejects.toThrow(ForbiddenException);
    expect(model.create).not.toHaveBeenCalled();
  });

  it.each(['AWAITING_PICKUP', 'ACTIVE', 'SETTLEMENT_PENDING', 'CANCELLED'])(
    'refuses a %s rental with 409',
    async (status) => {
      const { service, model } = setup({ ...closed, status });
      await expect(
        service.submit(as(OWNER_ID), { rentalId: RENTAL_ID, rating: 4 }, 'c'),
      ).rejects.toThrow('You can review a rental only after it is closed');
      expect(model.create).not.toHaveBeenCalled();
    },
  );

  it('answers 409 when the caller already reviewed the rental', async () => {
    const { service } = setup(closed, () =>
      Promise.reject(Object.assign(new Error('E11000'), { code: 11000 })),
    );
    const attempt = service.submit(
      as(OWNER_ID),
      { rentalId: RENTAL_ID, rating: 4 },
      'c',
    );
    await expect(attempt).rejects.toThrow(ConflictException);
    await expect(attempt).rejects.toThrow('You already reviewed this rental');
  });

  it('passes any other storage failure on', async () => {
    const { service } = setup(closed, () => Promise.reject(new Error('down')));
    await expect(
      service.submit(as(OWNER_ID), { rentalId: RENTAL_ID, rating: 4 }, 'c'),
    ).rejects.toThrow('down');
  });
});
