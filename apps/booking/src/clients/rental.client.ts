import { Injectable, Logger } from '@nestjs/common';
import type { CallContext } from './call-context.js';
import {
  errorMessage,
  postForResult,
  send,
  type ServiceResult,
} from './http-call.js';

/** What Rental did with the rental of a cancelled booking: cancelled it, or found none. */
export type RentalCancellation = 'cancelled' | 'no-rental';

/** Body of POST /internal/rentals, as proposed in docs/architecture/services.md. */
export interface CreateRentalRequest {
  /** Rental creates at most one rental per booking, so a retry returns the same rental. */
  bookingId: string;
  listingId: string;
  ownerId: string;
  renterId: string;
  period: { start: string; end: string };
  terms: { rentalFee: number; deposit: number; lateFeePerDay: number };
}

export interface CreatedRental {
  id: string;
}

function isCreatedRental(body: unknown): body is CreatedRental {
  return typeof (body as Partial<CreatedRental> | undefined)?.id === 'string';
}

/** Calls Rental's internal endpoints that open and cancel the rental of a booking. */
@Injectable()
export class RentalClient {
  private readonly logger = new Logger(RentalClient.name);
  private readonly baseUrl = process.env.RENTAL_URL ?? 'http://localhost:3003';

  /** Creates the rental. Never throws; a failure comes back as a ServiceResult. */
  create(
    request: CreateRentalRequest,
    call: CallContext,
  ): Promise<ServiceResult<CreatedRental>> {
    return postForResult(
      {
        service: 'rental',
        url: `${this.baseUrl}/internal/rentals`,
        body: request,
        correlationId: call.correlationId,
        isValid: isCreatedRental,
      },
      this.logger,
    );
  }

  /**
   * Cancels the rental of a booking before pickup; repeating it is safe. 404 means the booking
   * has no rental. Any other 4xx (409 once the item is picked up) is declined, with Rental's
   * message. Never throws; a failure comes back as a ServiceResult.
   */
  async cancelByBooking(
    bookingId: string,
    call: CallContext,
  ): Promise<ServiceResult<RentalCancellation>> {
    const reply = await send(
      {
        method: 'POST',
        url: `${this.baseUrl}/internal/rentals/by-booking/${bookingId}/cancel`,
        correlationId: call.correlationId,
      },
      this.logger,
    );
    const code = reply?.status ?? 0;
    if (code >= 200 && code < 300) {
      return { ok: true, value: 'cancelled' };
    }
    if (code === 404) {
      return { ok: true, value: 'no-rental' };
    }
    if (reply !== undefined && code >= 400 && code < 500) {
      return {
        ok: false,
        reason: 'declined',
        message:
          errorMessage(reply.body) ??
          `The rental service refused the cancellation (HTTP ${code})`,
      };
    }
    return {
      ok: false,
      reason: 'unavailable',
      message: 'The rental service is unavailable',
    };
  }
}
