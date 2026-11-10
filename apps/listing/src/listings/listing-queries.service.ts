import type { AuthUser } from '@app/common';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NO_REPUTATION, ReviewClient } from '../clients/review.client.js';
import { quoteFor } from '../internal/quote.js';
import type { OwnerListingsQuery } from './dto/owner-listings.query.js';
import type { QuoteQuery } from '../internal/quote.query.js';
import { QuoteResponse } from '../internal/quote.response.js';
import { Listing } from './listing.entity.js';
import { ListingResponse } from './listing.response.js';
import { ListingsService } from './listings.service.js';
import {
  OwnerListingResponse,
  type OwnerListingsResponse,
} from './owner-listing.response.js';

/** True when the viewer may see the listing in its current status. */
function canSee(listing: Listing, viewer: AuthUser | null): boolean {
  return (
    listing.status === 'PUBLISHED' ||
    viewer?.role === 'admin' ||
    listing.ownerId === viewer?.sub
  );
}

/** Read side of Listing: the detail page and the quote for Booking. */
@Injectable()
export class ListingQueriesService {
  constructor(
    @InjectRepository(Listing) private readonly listings: Repository<Listing>,
    private readonly listingsService: ListingsService,
    private readonly reviews: ReviewClient,
  ) {}

  /** All of this student's listings, including ones hidden from public search. */
  async mine(
    user: AuthUser,
    query: OwnerListingsQuery,
  ): Promise<OwnerListingsResponse> {
    if (user.role !== 'student') {
      throw new ForbiddenException('Only students have their own listings');
    }
    const [rows, total] = await this.listings.findAndCount({
      where: { ownerId: user.sub },
      select: {
        id: true,
        title: true,
        category: true,
        status: true,
        dailyRate: true,
        thumbnail: true,
        publishError: true,
        rejectionReason: true,
        createdAt: true,
      },
      order: { createdAt: 'DESC', id: 'ASC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });
    return {
      items: rows.map((row) => OwnerListingResponse.of(row)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /**
   * A PUBLISHED listing for anyone; any other status only for its owner and administrators
   * (404 for everyone else, so a hidden listing is indistinguishable from a missing one).
   */
  async detail(
    id: string,
    viewer: AuthUser | null,
    correlationId: string,
  ): Promise<ListingResponse> {
    const listing = await this.listings.findOneBy({ id });
    if (!listing || !canSee(listing, viewer)) {
      throw new NotFoundException('Listing not found');
    }
    const [photos, reputations] = await Promise.all([
      this.listingsService.photoUrls(id),
      this.reviews.reputations([listing.ownerId], correlationId),
    ]);
    return ListingResponse.of(
      listing,
      photos,
      reputations.get(listing.ownerId) ?? NO_REPUTATION,
    );
  }

  /** The terms Booking copies into a request. Only a PUBLISHED listing can be quoted. */
  async quote(id: string, query: QuoteQuery): Promise<QuoteResponse> {
    const listing = await this.listings.findOneBy({ id });
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }
    if (listing.status !== 'PUBLISHED') {
      throw new ConflictException('Listing is not published');
    }
    return QuoteResponse.of(
      quoteFor(listing, new Date(query.start), new Date(query.end)),
    );
  }
}
