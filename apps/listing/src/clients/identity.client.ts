import { CORRELATION_HEADER } from '@app/common';
import {
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

/** Identity answers within this time or counts as unavailable. */
const TIMEOUT_MS = 5_000;

interface Eligibility {
  canPublish: boolean;
  reasons: string[];
}

interface UserProfile {
  displayName: string;
}

/** Calls Identity's internal endpoints (docs/team-plan.md, interfaces between members). */
@Injectable()
export class IdentityClient {
  private readonly logger = new Logger(IdentityClient.name);
  private readonly baseUrl =
    process.env.IDENTITY_URL ?? 'http://localhost:3001';

  /**
   * Checks that the user may publish and returns the display name to show on the listing.
   * Throws 403 with Identity's reasons when the user may not publish.
   */
  async requirePublisher(
    userId: string,
    correlationId: string,
  ): Promise<string> {
    const eligibility = await this.get<Eligibility>(
      `/internal/users/${userId}/eligibility`,
      correlationId,
    );
    if (!eligibility.canPublish) {
      throw new ForbiddenException(
        `You cannot publish listings yet: ${eligibility.reasons.join(', ')}`,
      );
    }
    const profile = await this.get<UserProfile>(
      `/internal/users/${userId}/profile`,
      correlationId,
    );
    return profile.displayName;
  }

  private async get<T>(path: string, correlationId: string): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        headers: { [CORRELATION_HEADER]: correlationId },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      this.logger.warn(`Identity call ${path} failed: ${String(err)}`);
      throw new ServiceUnavailableException(
        'The identity service is unavailable',
      );
    }
    if (res.status === 404) {
      throw new ForbiddenException('Your account was not found');
    }
    if (!res.ok) {
      this.logger.warn(`Identity call ${path} answered ${res.status}`);
      throw new ServiceUnavailableException(
        'The identity service is unavailable',
      );
    }
    return (await res.json()) as T;
  }
}
