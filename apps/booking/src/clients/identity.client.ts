import { status } from '@grpc/grpc-js';
import { Injectable, Logger } from '@nestjs/common';
import { rpcError } from '../errors.js';
import type { CallContext } from './call-context.js';
import { isSuccess, send } from './http-call.js';

interface Eligibility {
  canBook: boolean;
  reasons: string[];
}

function isEligibility(body: unknown): body is Eligibility {
  const value = body as Partial<Eligibility> | undefined;
  return typeof value?.canBook === 'boolean' && Array.isArray(value.reasons);
}

/** Calls Identity's internal eligibility endpoint (docs/architecture/services.md). */
@Injectable()
export class IdentityClient {
  private readonly logger = new Logger(IdentityClient.name);
  private readonly baseUrl =
    process.env.IDENTITY_URL ?? 'http://localhost:3001';

  /**
   * Checks that the user may request a booking. Throws PERMISSION_DENIED with Identity's
   * reasons when they may not, and UNAVAILABLE when Identity cannot answer.
   */
  async requireBooker(userId: string, call: CallContext): Promise<void> {
    const reply = await send(
      {
        method: 'GET',
        url: `${this.baseUrl}/internal/users/${userId}/eligibility`,
        correlationId: call.correlationId,
      },
      this.logger,
    );
    if (reply?.status === 404) {
      throw rpcError(status.PERMISSION_DENIED, 'Your account was not found');
    }
    if (!isSuccess(reply) || !isEligibility(reply.body)) {
      throw rpcError(status.UNAVAILABLE, 'The identity service is unavailable');
    }
    if (!reply.body.canBook) {
      throw rpcError(
        status.PERMISSION_DENIED,
        `You cannot book yet: ${reply.body.reasons.join(', ')}`,
      );
    }
  }
}
