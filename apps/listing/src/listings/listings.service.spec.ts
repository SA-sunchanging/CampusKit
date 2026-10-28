import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { DataSource, Repository } from 'typeorm';
import {
  type CalendarClient,
  CalendarSetupError,
} from '../clients/calendar.client.js';
import type { IdentityClient } from '../clients/identity.client.js';
import type { CreateListingDto } from './dto/create-listing.dto.js';
import type { ListingPhoto } from './listing-photo.entity.js';
import type { Listing } from './listing.entity.js';
import { ListingsService } from './listings.service.js';

const owner = {
  sub: '00000000-0000-4000-8000-000000000001',
  role: 'student' as const,
};
const other = {
  sub: '00000000-0000-4000-8000-000000000002',
  role: 'student' as const,
};
const call = { authorization: 'Bearer t', correlationId: 'corr-1' };
const now = new Date('2026-10-28T05:00:00Z');
const photo = 'data:image/jpeg;base64,AAAA';
const listingId = '11111111-1111-4111-8111-111111111111';

const dto = {
  title: 'Calculus I textbook',
  category: 'BOOKS',
  description: 'Clean copy with a few pencil notes.',
  condition: 'GOOD',
  accessories: [' Solution manual '],
  replacementValue: 120000,
  dailyRate: 2000,
  deposit: 30000,
  lateFeePerDay: 4000,
  maxRentalDays: 7,
  pickupLocations: ['ENGINEERING'],
  blackouts: [{ start: '2026-11-01T17:00:00Z', end: '2026-11-03T17:00:00Z' }],
  photos: [photo],
  thumbnail: photo,
} satisfies CreateListingDto;

function setup() {
  const listingRepo = {
    create: vi.fn((fields: Partial<Listing>) => fields),
    save: vi.fn((listing: Partial<Listing>) =>
      Promise.resolve({ id: listingId, createdAt: now, ...listing } as Listing),
    ),
    findOneBy: vi.fn(),
  };
  const photoRepo = {
    insert: vi.fn(),
    find: vi.fn().mockResolvedValue([{ dataUrl: photo }]),
  };
  const tx = {
    getRepository: vi.fn((entity: { name: string }) =>
      entity.name === 'Listing' ? listingRepo : photoRepo,
    ),
  };
  const db = {
    transaction: vi.fn((work: (manager: typeof tx) => unknown) => work(tx)),
  };
  const identity = {
    requirePublisher: vi.fn().mockResolvedValue('Somchai Jaidee'),
  };
  const calendar = { setupCalendar: vi.fn().mockResolvedValue(undefined) };
  const service = new ListingsService(
    listingRepo as unknown as Repository<Listing>,
    photoRepo as unknown as Repository<ListingPhoto>,
    db as unknown as DataSource,
    identity as unknown as IdentityClient,
    calendar as unknown as CalendarClient,
  );
  return { service, listingRepo, photoRepo, identity, calendar, db };
}

describe('ListingsService.create', () => {
  it('saves a DRAFT, sets up the calendar, and publishes', async () => {
    const { service, listingRepo, photoRepo, calendar } = setup();
    const result = await service.create(owner, dto, call, now);
    expect(listingRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: owner.sub,
        ownerName: 'Somchai Jaidee',
        status: 'DRAFT',
        accessories: ['Solution manual'],
      }),
    );
    expect(photoRepo.insert).toHaveBeenCalledWith([
      { listingId, position: 0, dataUrl: photo },
    ]);
    expect(calendar.setupCalendar).toHaveBeenCalledWith(
      listingId,
      [{ start: '2026-11-01T17:00:00.000Z', end: '2026-11-03T17:00:00.000Z' }],
      call,
    );
    expect(result.status).toBe('PUBLISHED');
    expect(result.publishedAt).toBeInstanceOf(Date);
    expect(result.publishError).toBeNull();
    expect(result.photos).toEqual([photo]);
  });

  it('checks eligibility before saving anything', async () => {
    const { service, identity, db } = setup();
    identity.requirePublisher.mockRejectedValue(new ForbiddenException('no'));
    await expect(service.create(owner, dto, call, now)).rejects.toThrow(
      ForbiddenException,
    );
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('rejects invalid dates before saving a DRAFT', async () => {
    const { service, db } = setup();
    const bad = {
      ...dto,
      blackouts: [
        { start: '2026-11-01T00:00:00Z', end: '2026-11-02T00:00:00Z' },
      ],
    };
    await expect(service.create(owner, bad, call, now)).rejects.toThrow(
      BadRequestException,
    );
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('keeps the DRAFT with the reason when calendar setup fails', async () => {
    const { service, calendar } = setup();
    calendar.setupCalendar.mockRejectedValue(
      new CalendarSetupError('The booking service is unavailable'),
    );
    const result = await service.create(owner, dto, call, now);
    expect(result.status).toBe('DRAFT');
    expect(result.publishedAt).toBeNull();
    expect(result.publishError).toBe('The booking service is unavailable');
  });
});

describe('ListingsService.publish', () => {
  const draft = () => ({
    id: listingId,
    ownerId: owner.sub,
    status: 'DRAFT',
    blackouts: [],
    publishError: 'down',
    publishedAt: null,
  });

  it('publishes a DRAFT on retry', async () => {
    const { service, listingRepo, identity } = setup();
    listingRepo.findOneBy.mockResolvedValue(draft());
    const result = await service.publish(owner, listingId, call);
    expect(identity.requirePublisher).toHaveBeenCalled();
    expect(result.status).toBe('PUBLISHED');
    expect(result.publishError).toBeNull();
  });

  it('returns a PUBLISHED listing unchanged', async () => {
    const { service, listingRepo, calendar } = setup();
    listingRepo.findOneBy.mockResolvedValue({
      ...draft(),
      status: 'PUBLISHED',
      publishedAt: now,
    });
    const result = await service.publish(owner, listingId, call);
    expect(result.status).toBe('PUBLISHED');
    expect(calendar.setupCalendar).not.toHaveBeenCalled();
    expect(listingRepo.save).not.toHaveBeenCalled();
  });

  it('refuses anyone but the owner', async () => {
    const { service, listingRepo } = setup();
    listingRepo.findOneBy.mockResolvedValue(draft());
    await expect(service.publish(other, listingId, call)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('answers 404 for an unknown listing', async () => {
    const { service, listingRepo } = setup();
    listingRepo.findOneBy.mockResolvedValue(null);
    await expect(service.publish(owner, listingId, call)).rejects.toThrow(
      NotFoundException,
    );
  });
});
