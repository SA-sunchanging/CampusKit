import { CORRELATION_HEADER } from '@app/common';
import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

/** Rental answers within this time or counts as unavailable. */
export const TIMEOUT_MS = 5_000;

/** Reply of Rental's GET /internal/rentals/{id} (docs/architecture/services.md). */
export interface RentalView {
  id: string;
  listingId: string;
  ownerId: string;
  renterId: string;
  /** Only CLOSED can be reviewed. */
  status: string;
}

function isRentalView(body: unknown): body is RentalView {
  const rental = body as Partial<RentalView> | undefined;
  return (
    typeof rental?.id === 'string' &&
    typeof rental.listingId === 'string' &&
    typeof rental.ownerId === 'string' &&
    typeof rental.renterId === 'string' &&
    typeof rental.status === 'string'
  );
}

/** Calls Rental's internal endpoint to learn who took part in a rental and how it ended. */
@Injectable()
export class RentalClient {
  private readonly logger = new Logger(RentalClient.name);
  private readonly baseUrl = process.env.RENTAL_URL ?? 'http://localhost:3003';

  /** Throws 404 when Rental does not know the rental and 503 when Rental cannot answer. */
  async get(id: string, correlationId: string): Promise<RentalView> {
    const url = `${this.baseUrl}/internal/rentals/${encodeURIComponent(id)}`;
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { [CORRELATION_HEADER]: correlationId },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      this.logger.warn(`GET ${url} failed: ${String(err)}`);
      throw unavailable();
    }
    if (res.status === 404) {
      throw new NotFoundException('Rental not found');
    }
    const body: unknown = await res.json().catch(() => undefined);
    if (!res.ok || !isRentalView(body)) {
      this.logger.warn(`GET ${url} answered ${res.status}`);
      throw unavailable();
    }
    return body;
  }
}

function unavailable(): ServiceUnavailableException {
  return new ServiceUnavailableException('The rental service is unavailable');
}
