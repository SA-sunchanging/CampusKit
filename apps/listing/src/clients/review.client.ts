import { CORRELATION_HEADER, SERVICE_TOKEN_HEADER } from '@app/common';
import { Injectable, Logger } from '@nestjs/common';
import { serviceTokens } from './service-token.js';

/** Review answers within this time, or the listings show no rating. Kept short for search. */
const TIMEOUT_MS = 1_500;

/** How renters rated a listing owner, as search results and the detail page show it. */
export interface OwnerReputation {
  /** Mean rating to one decimal; null without reviews or while Review is unavailable. */
  ownerRating: number | null;
  ownerReviewCount: number;
}

export const NO_REPUTATION: OwnerReputation = {
  ownerRating: null,
  ownerReviewCount: 0,
};

interface ReputationItem {
  userId: string;
  averageRating: number | null;
  reviewCount: number;
}

/** Calls Review's internal endpoints (docs/team-plan.md, interfaces between members). */
@Injectable()
export class ReviewClient {
  private readonly logger = new Logger(ReviewClient.name);
  private readonly baseUrl = process.env.REVIEW_URL ?? 'http://localhost:3005';

  /**
   * The reputation of each user (at most 50 distinct IDs) in one call, keyed by user ID. Fails
   * soft: when Review fails or is slow, logs a warning and returns an empty map.
   */
  async reputations(
    userIds: string[],
    correlationId: string,
  ): Promise<Map<string, OwnerReputation>> {
    const unique = [...new Set(userIds)];
    if (unique.length === 0) {
      return new Map();
    }
    const path = `/internal/reputation?userIds=${unique.join(',')}`;
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        headers: {
          [CORRELATION_HEADER]: correlationId,
          [SERVICE_TOKEN_HEADER]: serviceTokens.token(),
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) {
        this.logger.warn(`Review call ${path} answered ${res.status}`);
        return new Map();
      }
      const body = (await res.json()) as { items: ReputationItem[] };
      return new Map(
        body.items.map((item) => [
          item.userId,
          {
            ownerRating: item.averageRating,
            ownerReviewCount: item.reviewCount,
          },
        ]),
      );
    } catch (err) {
      this.logger.warn(`Review call ${path} failed: ${String(err)}`);
      return new Map();
    }
  }
}
