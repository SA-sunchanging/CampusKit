import type { AuthUser } from '@app/common';
import {
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
import { checkPhotoSizes } from './photos.js';

/** Creating and publishing listings (UC-1 in docs/reference/use-cases.md). */
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
   * cannot set up the calendar the DRAFT stays, with publishError saying why.
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
          publishedAt: null,
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

  /** Retries publishing a DRAFT. Publishing a PUBLISHED listing again changes nothing. */
  async publish(
    user: AuthUser,
    id: string,
    call: CallContext,
  ): Promise<ListingResponse> {
    const listing = await this.listings.findOneBy({ id });
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }
    if (listing.ownerId !== user.sub) {
      throw new ForbiddenException('Only the owner can publish this listing');
    }
    const photos = await this.photoUrls(id);
    if (listing.status === 'PUBLISHED') {
      return ListingResponse.of(listing, photos);
    }
    // Eligibility can change after the DRAFT was saved, for example a suspension.
    await this.identity.requirePublisher(user.sub, call.correlationId);
    return this.tryPublish(listing, photos, call);
  }

  /** Data URLs of a listing's photos, cover first. */
  async photoUrls(listingId: string): Promise<string[]> {
    const rows = await this.photos.find({
      where: { listingId },
      order: { position: 'ASC' },
    });
    return rows.map((row) => row.dataUrl);
  }

  /**
   * Publishes when Booking sets up the calendar; otherwise the DRAFT keeps publishError saying
   * why and nothing is announced.
   */
  private async tryPublish(
    listing: Listing,
    photos: string[],
    call: CallContext,
  ): Promise<ListingResponse> {
    const ready = await this.setUpCalendar(listing, call);
    const saved = ready
      ? await this.markPublished(listing.id, call)
      : await this.recordPublishError(listing);
    return ListingResponse.of(saved, photos);
  }

  /**
   * DRAFT becomes PUBLISHED once, even when two publishes race; only the publish that made the
   * change writes listing.published, in the same transaction.
   */
  private markPublished(id: string, call: CallContext): Promise<Listing> {
    return this.db.transaction(async (tx) => {
      const repo = tx.getRepository(Listing);
      const { affected } = await repo.update(
        { id, status: 'DRAFT' },
        { status: 'PUBLISHED', publishedAt: new Date(), publishError: null },
      );
      const row = await repo.findOneByOrFail({ id });
      if (affected === 1) {
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
