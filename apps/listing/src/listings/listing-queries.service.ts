import type { AuthUser } from '@app/common';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

/** Read side of Listing: search, detail, and the quote for Booking. */
@Injectable()
export class ListingQueriesService {
  constructor(
    @InjectRepository(Listing) private readonly listings: Repository<Listing>,
    private readonly listingsService: ListingsService,
  ) {}

  /** PUBLISHED listings matching the keyword and category, newest first. */
  async search(query: SearchListingsQuery): Promise<SearchResultResponse> {
    const builder = this.listings
      .createQueryBuilder('listing')
      .where('listing.status = :status', { status: 'PUBLISHED' });
    if (query.category) {
      builder.andWhere('listing.category = :category', {
        category: query.category,
      });
    }
    if (query.q) {
      builder.andWhere(
        '(listing.title ILIKE :pattern OR listing.description ILIKE :pattern)',
        { pattern: likePattern(query.q) },
      );
    }
    const [rows, total] = await builder
      .orderBy('listing.publishedAt', 'DESC')
      .addOrderBy('listing.id', 'ASC')
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize)
      .getManyAndCount();
    return {
      items: rows.map((row) => ListingSummaryResponse.of(row)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** A PUBLISHED listing for anyone; a DRAFT only for its owner (404 for everyone else). */
  async detail(id: string, viewer: AuthUser | null): Promise<ListingResponse> {
    const listing = await this.listings.findOneBy({ id });
    if (
      !listing ||
      (listing.status !== 'PUBLISHED' && listing.ownerId !== viewer?.sub)
    ) {
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
