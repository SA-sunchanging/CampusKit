import {
  BadRequestException,
  ConflictException,
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
  /** The one listing row the fake repository holds. */
  let stored: Partial<Listing> | undefined;
  const store = (listing: Partial<Listing> | undefined) => {
    stored = listing;
  };
  const listingRepo = {
    create: vi.fn((fields: Partial<Listing>) => fields),
    save: vi.fn((listing: Partial<Listing>) => {
      store({ id: listingId, createdAt: now, ...listing });
      return Promise.resolve({ ...stored } as Listing);
    }),
    findOneBy: vi.fn(() => Promise.resolve(stored ? { ...stored } : null)),
    findOneByOrFail: vi.fn(() => Promise.resolve({ ...stored } as Listing)),
    update: vi.fn((where: Partial<Listing>, fields: Partial<Listing>) => {
      const match = stored !== undefined && stored.status === where.status;
      if (stored && match) {
        Object.assign(stored, fields);
      }
      return Promise.resolve({ affected: match ? 1 : 0 });
    }),
  };
  const photoRepo = {
    insert: vi.fn(),
    find: vi.fn().mockResolvedValue([{ dataUrl: photo }]),
  };
  const tx = {
    getRepository: vi.fn((entity: { name: string }) =>
      entity.name === 'Listing' ? listingRepo : photoRepo,
    ),
    query: vi.fn().mockResolvedValue([]),
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
  /** The envelopes written to the outbox, in order. */
  const events = () =>
    tx.query.mock.calls
      .filter(([sql]) => String(sql).includes('INSERT INTO outbox_events'))
      .map(([, params]) => JSON.parse((params as string[])[2]) as unknown);
  return {
    service,
    listingRepo,
    photoRepo,
    identity,
    calendar,
    db,
    events,
    store,
  };
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

  it('announces the published listing to its owner in the same transaction', async () => {
    const { service, db, events } = setup();
    await service.create(owner, dto, call, now);
    expect(db.transaction).toHaveBeenCalledTimes(2);
    expect(events()).toEqual([
      expect.objectContaining({
        type: 'listing.published',
        producer: 'listing',
        recipients: [owner.sub],
        correlationId: 'corr-1',
        data: {
          listingId,
          ownerId: owner.sub,
          title: 'Calculus I textbook',
          status: 'PUBLISHED',
        },
      }),
    ]);
  });

  it('holds a high-value listing for review and announces nothing', async () => {
    const { service, events } = setup();
    const result = await service.create(
      owner,
      { ...dto, replacementValue: 1_000_000 },
      call,
      now,
    );
    expect(result.status).toBe('PENDING_REVIEW');
    expect(result.moderationFlags).toEqual([
      'Replacement value is 10,000 THB or more',
    ]);
    expect(result.publishedAt).toBeNull();
    expect(events()).toEqual([]);
  });

  it('holds a listing that mentions a flagged word for review', async () => {
    const { service, events } = setup();
    const result = await service.create(
      owner,
      { ...dto, description: 'Includes a bottle of liquor.' },
      call,
      now,
    );
    expect(result.status).toBe('PENDING_REVIEW');
    expect(result.moderationFlags).toEqual(['Mentions "liquor"']);
    expect(events()).toEqual([]);
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

  it('announces nothing when calendar setup fails', async () => {
    const { service, calendar, listingRepo, events } = setup();
    calendar.setupCalendar.mockRejectedValue(
      new CalendarSetupError('The booking service is unavailable'),
    );
    await service.create(owner, dto, call, now);
    expect(events()).toEqual([]);
    expect(listingRepo.update).toHaveBeenCalledWith(
      { id: listingId, status: 'DRAFT' },
      { publishError: 'The booking service is unavailable' },
    );
  });
});

describe('ListingsService.publish', () => {
  const draft = () => ({
    id: listingId,
    ownerId: owner.sub,
    status: 'DRAFT' as const,
    title: dto.title,
    description: dto.description,
    replacementValue: dto.replacementValue,
    blackouts: [],
    publishError: 'down',
    publishedAt: null,
  });

  it('publishes a DRAFT on retry', async () => {
    const { service, identity, store } = setup();
    store(draft());
    const result = await service.publish(owner, listingId, call);
    expect(identity.requirePublisher).toHaveBeenCalled();
    expect(result.status).toBe('PUBLISHED');
    expect(result.publishError).toBeNull();
  });

  it('announces a DRAFT published on retry', async () => {
    const { service, events, store } = setup();
    store(draft());
    await service.publish(owner, listingId, call);
    expect(events()).toEqual([
      expect.objectContaining({
        type: 'listing.published',
        recipients: [owner.sub],
      }),
    ]);
  });

  it('holds a flagged DRAFT for review on retry', async () => {
    const { service, events, store } = setup();
    store({ ...draft(), title: 'Replica sword', description: 'Display only' });
    const result = await service.publish(owner, listingId, call);
    expect(result.status).toBe('PENDING_REVIEW');
    expect(result.moderationFlags).toEqual(['Mentions "replica"']);
    expect(result.publishError).toBeNull();
    expect(events()).toEqual([]);
  });

  it('returns a listing waiting for review unchanged', async () => {
    const { service, calendar, listingRepo, store } = setup();
    store({ ...draft(), status: 'PENDING_REVIEW', publishError: null });
    const result = await service.publish(owner, listingId, call);
    expect(result.status).toBe('PENDING_REVIEW');
    expect(calendar.setupCalendar).not.toHaveBeenCalled();
    expect(listingRepo.update).not.toHaveBeenCalled();
  });

  it.each(['REJECTED', 'UNPUBLISHED'] as const)(
    'refuses to publish a %s listing again',
    async (status) => {
      const { service, calendar, store } = setup();
      store({ ...draft(), status });
      await expect(service.publish(owner, listingId, call)).rejects.toThrow(
        ConflictException,
      );
      expect(calendar.setupCalendar).not.toHaveBeenCalled();
    },
  );

  it('returns a PUBLISHED listing unchanged and announces nothing', async () => {
    const { service, listingRepo, calendar, events, store } = setup();
    store({
      ...draft(),
      status: 'PUBLISHED',
      publishedAt: now,
    });
    const result = await service.publish(owner, listingId, call);
    expect(result.status).toBe('PUBLISHED');
    expect(calendar.setupCalendar).not.toHaveBeenCalled();
    expect(listingRepo.save).not.toHaveBeenCalled();
    expect(listingRepo.update).not.toHaveBeenCalled();
    expect(events()).toEqual([]);
  });

  it('announces nothing when a concurrent publish won the race', async () => {
    const { service, calendar, events, store } = setup();
    store(draft());
    calendar.setupCalendar.mockImplementation(() => {
      store({ ...draft(), status: 'PUBLISHED', publishedAt: now });
      return Promise.resolve();
    });
    const result = await service.publish(owner, listingId, call);
    expect(result.status).toBe('PUBLISHED');
    expect(result.publishedAt).toBe(now);
    expect(events()).toEqual([]);
  });

  it('keeps a listing a concurrent publish made PUBLISHED when its own setup fails', async () => {
    const { service, calendar, events, store } = setup();
    store(draft());
    calendar.setupCalendar.mockImplementation(() => {
      store({ ...draft(), status: 'PUBLISHED', publishError: null });
      return Promise.reject(new CalendarSetupError('down'));
    });
    const result = await service.publish(owner, listingId, call);
    expect(result.status).toBe('PUBLISHED');
    expect(result.publishError).toBeNull();
    expect(events()).toEqual([]);
  });

  it('refuses anyone but the owner', async () => {
    const { service, store } = setup();
    store(draft());
    await expect(service.publish(other, listingId, call)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('answers 404 for an unknown listing', async () => {
    const { service } = setup();
    await expect(service.publish(owner, listingId, call)).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('ListingsService.unpublish', () => {
  const published = () => ({
    id: listingId,
    ownerId: owner.sub,
    status: 'PUBLISHED' as const,
    publishedAt: now,
    unpublishedAt: null,
  });
  const later = new Date('2026-10-30T05:00:00Z');

  it('takes a PUBLISHED listing down and keeps when it was published', async () => {
    const { service, listingRepo, events, store } = setup();
    store(published());
    const result = await service.unpublish(owner, listingId, later);
    expect(listingRepo.update).toHaveBeenCalledWith(
      { id: listingId, status: 'PUBLISHED' },
      { status: 'UNPUBLISHED', unpublishedAt: later },
    );
    expect(result).toMatchObject({
      status: 'UNPUBLISHED',
      publishedAt: now,
      unpublishedAt: later,
    });
    expect(events()).toEqual([]);
  });

  it('returns an UNPUBLISHED listing unchanged', async () => {
    const { service, store } = setup();
    store({ ...published(), status: 'UNPUBLISHED', unpublishedAt: now });
    const result = await service.unpublish(owner, listingId, later);
    expect(result).toMatchObject({
      status: 'UNPUBLISHED',
      unpublishedAt: now,
    });
  });

  it.each(['DRAFT', 'PENDING_REVIEW', 'REJECTED'] as const)(
    'answers 409 for a %s listing',
    async (status) => {
      const { service, store } = setup();
      store({ ...published(), status, publishedAt: null });
      await expect(service.unpublish(owner, listingId, later)).rejects.toThrow(
        ConflictException,
      );
    },
  );

  it('refuses anyone but the owner', async () => {
    const { service, listingRepo, store } = setup();
    store(published());
    await expect(service.unpublish(other, listingId, later)).rejects.toThrow(
      ForbiddenException,
    );
    expect(listingRepo.update).not.toHaveBeenCalled();
  });

  it('answers 404 for an unknown listing', async () => {
    const { service } = setup();
    await expect(service.unpublish(owner, listingId, later)).rejects.toThrow(
      NotFoundException,
    );
  });
});
