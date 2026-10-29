import { status } from '@grpc/grpc-js';
import { Injectable, Logger } from '@nestjs/common';
import type { Period } from '../calendar/date-range.js';
import { rpcError } from '../errors.js';
import type { CallContext } from './call-context.js';
import { errorMessage, isSuccess, send } from './http-call.js';

/** Body of Listing's GET /internal/listings/{id}/quote. Money is integer satang. */
export interface Quote {
  listingId: string;
  ownerId: string;
  days: number;
  rentalFee: number;
  deposit: number;
  lateFeePerDay: number;
}

function isQuote(body: unknown): body is Quote {
  const value = body as Partial<Quote> | undefined;
  return (
    typeof value?.listingId === 'string' &&
    typeof value.ownerId === 'string' &&
    [value.days, value.rentalFee, value.deposit, value.lateFeePerDay].every(
      (amount) => Number.isInteger(amount),
    )
  );
}

/** Calls Listing's internal quote endpoint (docs/architecture/services.md). */
@Injectable()
export class ListingClient {
  private readonly logger = new Logger(ListingClient.name);
  private readonly baseUrl = process.env.LISTING_URL ?? 'http://localhost:3002';

  /**
   * The terms of renting the listing for the period. Throws NOT_FOUND for an unknown listing,
   * FAILED_PRECONDITION for one that is not published, INVALID_ARGUMENT for a period Listing
   * refuses, and UNAVAILABLE when Listing cannot answer.
   */
  async quote(
    listingId: string,
    period: Period,
    call: CallContext,
  ): Promise<Quote> {
    const query = new URLSearchParams({
      start: period.start.toISOString(),
      end: period.end.toISOString(),
    });
    const reply = await send(
      {
        method: 'GET',
        url: `${this.baseUrl}/internal/listings/${listingId}/quote?${query}`,
        correlationId: call.correlationId,
      },
      this.logger,
    );
    if (isSuccess(reply) && isQuote(reply.body)) {
      return reply.body;
    }
    const message = errorMessage(reply?.body);
    switch (reply?.status) {
      case 400:
        throw rpcError(
          status.INVALID_ARGUMENT,
          message ?? 'The period cannot be booked',
        );
      case 404:
        throw rpcError(status.NOT_FOUND, 'Listing not found');
      case 409:
        throw rpcError(
          status.FAILED_PRECONDITION,
          message ?? 'Listing is not published',
        );
      default:
        throw rpcError(
          status.UNAVAILABLE,
          'The listing service is unavailable',
        );
    }
  }
}
