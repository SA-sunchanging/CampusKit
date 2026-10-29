import type { AuthUser } from '@app/common';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import type { CallContext } from '../clients/call-context.js';
import {
  CalendarClient,
  CalendarSetupError,
} from '../clients/calendar.client.js';
import { IdentityClient } from '../clients/identity.client.js';
import { checkBlackouts } from './blackouts.js';
import { announcePublished } from './listing-events.js';
import type { CreateListingDto } from './dto/create-listing.dto.js';
import { ListingPhoto } from './listing-photo.entity.js';
import { Listing } from './listing.entity.js';
import { ListingResponse } from './listing.response.js';
import { moderationFlags } from './moderation-rules.js';
import { checkPhotoSizes } from './photos.js';

/** Creating, publishing, and unpublishing listings (UC-1 in docs/reference/use-cases.md). */
@Injectable()
export class ListingsService {
  constructor(
    @InjectRepository(Listing) private readonly listings: Repository<Listing>,
    @InjectRepository(ListingPhoto)
    private readonly photos: Repository<ListingPhoto>,
    @InjectDataSource() private readonly db: DataSource,
    private readonly identity: IdentityClient,
    private readonly calendar: CalendarClient,
  ) {}

  /**
   * Checks eligibility, validates, saves a DRAFT, and then tries to publish it. When Booking
   * cannot set up the calendar the DRAFT stays, with publishError saying why. A listing the
   * moderation rule flags waits in PENDING_REVIEW instead of being published.
   */
  async create(
    user: AuthUser,
    dto: CreateListingDto,
    call: CallContext,
    now = new Date(),
  ): Promise<ListingResponse> {
    const ownerName = await this.identity.requirePublisher(
      user.sub,
      call.correlationId,
    );
    const blackouts = checkBlackouts(dto.blackouts, now);
    checkPhotoSizes(dto.photos, dto.thumbnail);
    const listing = await this.db.transaction(async (tx) => {
      const draft = await tx.getRepository(Listing).save(
        tx.getRepository(Listing).create({
          ownerId: user.sub,
          ownerName,
          status: 'DRAFT',
          title: dto.title,
          category: dto.category,
          description: dto.description,
          condition: dto.condition,
          accessories: dto.accessories.map((item) => item.trim()),
          replacementValue: dto.replacementValue,
          dailyRate: dto.dailyRate,
          deposit: dto.deposit,
          lateFeePerDay: dto.lateFeePerDay,
          maxRentalDays: dto.maxRentalDays,
          pickupLocations: dto.pickupLocations,
          blackouts,
          thumbnail: dto.thumbnail,
          publishError: null,
          moderationFlags: [],
          rejectionReason: null,
          reviewedBy: null,
          reviewedAt: null,
          publishedAt: null,
          unpublishedAt: null,
        }),
      );
      await tx.getRepository(ListingPhoto).insert(
        dto.photos.map((dataUrl, position) => ({
          listingId: draft.id,
          position,
          dataUrl,
        })),
      );
      return draft;
    });
    return this.tryPublish(listing, dto.photos, call);
  }

  /**
   * Retries publishing a DRAFT. A listing that is PUBLISHED or waiting for review is returned
   * unchanged; a REJECTED or UNPUBLISHED one cannot be published again (409).
   */
  async publish(
    user: AuthUser,
    id: string,
    call: CallContext,
  ): Promise<ListingResponse> {
    const listing = await this.ownListing(user, id, 'publish');
    if (listing.status === 'REJECTED' || listing.status === 'UNPUBLISHED') {
      throw new ConflictException(
        `A listing that is ${listing.status} cannot be published again`,
      );
    }
    const photos = await this.photoUrls(id);
    if (listing.status !== 'DRAFT') {
      return ListingResponse.of(listing, photos);
    }
    // Eligibility can change after the DRAFT was saved, for example a suspension.
    await this.identity.requirePublisher(user.sub, call.correlationId);
    return this.tryPublish(listing, photos, call);
  }

  /**
   * Takes a PUBLISHED listing out of search and booking; nothing is announced. Bookings already
   * made keep the terms they copied. Unpublishing again changes nothing; any status other than
   * PUBLISHED or UNPUBLISHED answers 409.
   */
  async unpublish(
    user: AuthUser,
    id: string,
    now = new Date(),
  ): Promise<ListingResponse> {
    await this.ownListing(user, id, 'unpublish');
    await this.listings.update(
      { id, status: 'PUBLISHED' },
      { status: 'UNPUBLISHED', unpublishedAt: now },
    );
    const listing = await this.listings.findOneByOrFail({ id });
    if (listing.status !== 'UNPUBLISHED') {
      throw new ConflictException(
        `A listing that is ${listing.status} cannot be unpublished`,
      );
    }
    return ListingResponse.of(listing, await this.photoUrls(id));
  }

  /** Data URLs of a listing's photos, cover first. */
  async photoUrls(listingId: string): Promise<string[]> {
    const rows = await this.photos.find({
      where: { listingId },
      order: { position: 'ASC' },
    });
    return rows.map((row) => row.dataUrl);
  }

  /** The listing, when the caller owns it; 404 when it does not exist, 403 for anyone else. */
  private async ownListing(
    user: AuthUser,
    id: string,
    action: string,
  ): Promise<Listing> {
    const listing = await this.listings.findOneBy({ id });
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }
    if (listing.ownerId !== user.sub) {
      throw new ForbiddenException(`Only the owner can ${action} this listing`);
    }
    return listing;
  }

  /**
   * Publishes (or holds for review) when Booking sets up the calendar; otherwise the DRAFT keeps
   * publishError saying why and nothing is announced.
   */
  private async tryPublish(
    listing: Listing,
    photos: string[],
    call: CallContext,
  ): Promise<ListingResponse> {
    const ready = await this.setUpCalendar(listing, call);
    const saved = ready
      ? await this.leaveDraft(listing, call)
      : await this.recordPublishError(listing);
    return ListingResponse.of(saved, photos);
  }

  /**
   * DRAFT leaves once, even when two publishes race: to PENDING_REVIEW with the reasons when the
   * moderation rule flags it, otherwise to PUBLISHED. Only the publish that made the change to
   * PUBLISHED writes listing.published, in the same transaction.
   */
  private leaveDraft(listing: Listing, call: CallContext): Promise<Listing> {
    const flags = moderationFlags(listing);
    const id = listing.id;
    return this.db.transaction(async (tx) => {
      const repo = tx.getRepository(Listing);
      const { affected } = await repo.update(
        { id, status: 'DRAFT' },
        flags.length > 0
          ? {
              status: 'PENDING_REVIEW',
              moderationFlags: flags,
              publishError: null,
            }
          : {
              status: 'PUBLISHED',
              publishedAt: new Date(),
              publishError: null,
            },
      );
      const row = await repo.findOneByOrFail({ id });
      if (affected === 1 && row.status === 'PUBLISHED') {
        await announcePublished(tx, row, call.correlationId);
      }
      return row;
    });
  }

  /** Keeps why publishing failed, unless a concurrent publish has succeeded meanwhile. */
  private async recordPublishError(listing: Listing): Promise<Listing> {
    await this.listings.update(
      { id: listing.id, status: 'DRAFT' },
      { publishError: listing.publishError },
    );
    return this.listings.findOneByOrFail({ id: listing.id });
  }

  /** True when the calendar exists; otherwise records why on the listing (not yet saved). */
  private async setUpCalendar(
    listing: Listing,
    call: CallContext,
  ): Promise<boolean> {
    try {
      await this.calendar.setupCalendar(listing.id, listing.blackouts, call);
      return true;
    } catch (error) {
      if (!(error instanceof CalendarSetupError)) {
        throw error;
      }
      listing.publishError = error.message;
      return false;
    }
  }
}
