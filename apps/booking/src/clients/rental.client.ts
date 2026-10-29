import { Injectable, Logger } from '@nestjs/common';
import type { CallContext } from './call-context.js';
import { postForResult, type ServiceResult } from './http-call.js';

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

/** Calls Rental's internal endpoint that opens the rental of a confirmed booking. */
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
}
