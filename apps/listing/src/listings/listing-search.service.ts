import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, type SelectQueryBuilder } from 'typeorm';
import { CalendarClient } from '../clients/calendar.client.js';
import { NO_REPUTATION, ReviewClient } from '../clients/review.client.js';
import type { SearchListingsQuery } from './dto/search-listings.query.js';
import {
  ListingSummaryResponse,
  type SearchResultResponse,
} from './listing-summary.response.js';
import { Listing } from './listing.entity.js';

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

/** Search of PUBLISHED listings, with the availability filter and owner ratings. */
@Injectable()
export class ListingSearchService {
  constructor(
    @InjectRepository(Listing) private readonly listings: Repository<Listing>,
    private readonly calendar: CalendarClient,
    private readonly reviews: ReviewClient,
  ) {}

  /**
   * PUBLISHED listings matching the keyword, category, and pickup point, newest first. With
   * dates, only those Booking reports free for the whole period. Each carries its owner's
   * reputation from one Review call per page.
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
    const reputations = await this.reviews.reputations(
      rows.map((row) => row.ownerId),
      correlationId,
    );
    return {
      items: rows.map((row) =>
        ListingSummaryResponse.of(
          row,
          reputations.get(row.ownerId) ?? NO_REPUTATION,
        ),
      ),
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
}
