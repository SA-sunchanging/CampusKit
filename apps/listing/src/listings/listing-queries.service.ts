import type { AuthUser } from '@app/common';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, type SelectQueryBuilder } from 'typeorm';
import { CalendarClient } from '../clients/calendar.client.js';
import { quoteFor } from '../internal/quote.js';
import type { QuoteQuery } from '../internal/quote.query.js';
import { QuoteResponse } from '../internal/quote.response.js';
import type { SearchListingsQuery } from './dto/search-listings.query.js';
import {
  ListingSummaryResponse,
  type SearchResultResponse,
} from './listing-summary.response.js';
import { Listing } from './listing.entity.js';
import { ListingResponse } from './listing.response.js';
import { ListingsService } from './listings.service.js';

/** Escapes LIKE wildcards so a keyword such as "100%" matches literally. */
export function likePattern(keyword: string): string {
  return `%${keyword.replace(/[\\%_]/g, '\\$&')}%`;
}

/**
 * A search with dates checks at most this many matching listings with Booking, the most one
 * FilterAvailable call takes; later matches are left out of the results.
 */
export const MAX_DATED_CANDIDATES = 200;

interface SearchPage {
  rows: Listing[];
  total: number;
}

/** True when the viewer may see the listing in its current status. */
function canSee(listing: Listing, viewer: AuthUser | null): boolean {
  return (
    listing.status === 'PUBLISHED' ||
    viewer?.role === 'admin' ||
    listing.ownerId === viewer?.sub
  );
}

/** Read side of Listing: search, detail, and the quote for Booking. */
@Injectable()
export class ListingQueriesService {
  constructor(
    @InjectRepository(Listing) private readonly listings: Repository<Listing>,
    private readonly listingsService: ListingsService,
    private readonly calendar: CalendarClient,
  ) {}

  /**
   * PUBLISHED listings matching the keyword, category, and pickup point, newest first. With
   * dates, only those Booking reports free for the whole period.
   */
  async search(
    query: SearchListingsQuery,
    correlationId: string,
  ): Promise<SearchResultResponse> {
    const builder = this.matching(query);
    const { rows, total } =
      query.start && query.end
        ? await this.availablePage(
            builder,
            query,
            { start: query.start, end: query.end },
            correlationId,
          )
        : await this.page(builder, query);
    return {
      items: rows.map((row) => ListingSummaryResponse.of(row)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  private matching(query: SearchListingsQuery): SelectQueryBuilder<Listing> {
    const builder = this.listings
      .createQueryBuilder('listing')
      .where('listing.status = :status', { status: 'PUBLISHED' });
    if (query.category) {
      builder.andWhere('listing.category = :category', {
        category: query.category,
      });
    }
    if (query.location) {
      builder.andWhere(':location = ANY(listing.pickupLocations)', {
        location: query.location,
      });
    }
    if (query.q) {
      builder.andWhere(
        '(listing.title ILIKE :pattern OR listing.description ILIKE :pattern)',
        { pattern: likePattern(query.q) },
      );
    }
    return builder
      .orderBy('listing.publishedAt', 'DESC')
      .addOrderBy('listing.id', 'ASC');
  }

  private async page(
    builder: SelectQueryBuilder<Listing>,
    query: SearchListingsQuery,
  ): Promise<SearchPage> {
    const [rows, total] = await builder
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize)
      .getManyAndCount();
    return { rows, total };
  }

  /**
   * Asks Booking once which of the first 200 matches are free, keeps their order, and pages
   * through them in memory. total counts the free listings among those candidates.
   */
  private async availablePage(
    builder: SelectQueryBuilder<Listing>,
    query: SearchListingsQuery,
    period: { start: string; end: string },
    correlationId: string,
  ): Promise<SearchPage> {
    const candidates = await builder
      .select('listing.id')
      .limit(MAX_DATED_CANDIDATES)
      .getMany();
    if (candidates.length === 0) {
      return { rows: [], total: 0 };
    }
    const available = await this.calendar.filterAvailable(
      candidates.map((candidate) => candidate.id),
      {
        start: new Date(period.start).toISOString(),
        end: new Date(period.end).toISOString(),
      },
      correlationId,
    );
    const offset = (query.page - 1) * query.pageSize;
    const pageIds = available.slice(offset, offset + query.pageSize);
    const rows =
      pageIds.length === 0
        ? []
        : await this.listings.findBy({
            id: In(pageIds),
            status: 'PUBLISHED',
          });
    const byId = new Map(rows.map((row) => [row.id, row]));
    return {
      rows: pageIds.flatMap((id) => byId.get(id) ?? []),
      total: available.length,
    };
  }

  /**
   * A PUBLISHED listing for anyone; any other status only for its owner and administrators
   * (404 for everyone else, so a hidden listing is indistinguishable from a missing one).
   */
  async detail(id: string, viewer: AuthUser | null): Promise<ListingResponse> {
    const listing = await this.listings.findOneBy({ id });
    if (!listing || !canSee(listing, viewer)) {
      throw new NotFoundException('Listing not found');
    }
    return ListingResponse.of(
      listing,
      await this.listingsService.photoUrls(id),
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
