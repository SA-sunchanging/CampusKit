import { Injectable, Logger } from '@nestjs/common';
import type { CallContext } from './call-context.js';
import { postForResult, type ServiceResult } from './http-call.js';

/** Body of POST /internal/payments/authorize, as proposed in docs/architecture/services.md. */
export interface AuthorizeRequest {
  /** Stable per booking and kind, so a retry never authorizes twice. */
  operationId: string;
  bookingId: string;
  /** The renter. */
  payerId: string;
  /** The listing owner. */
  payeeId: string;
  kind: 'FEE' | 'DEPOSIT';
  /** Integer satang. */
  amount: number;
}

export interface Authorization {
  id: string;
  status: string;
}

function isAuthorization(body: unknown): body is Authorization {
  const value = body as Partial<Authorization> | undefined;
  return typeof value?.id === 'string' && typeof value.status === 'string';
}

/** Calls Payment's internal authorization endpoint. */
@Injectable()
export class PaymentClient {
  private readonly logger = new Logger(PaymentClient.name);
  private readonly baseUrl = process.env.PAYMENT_URL ?? 'http://localhost:3004';

  /** Authorizes one amount. Never throws; a failure comes back as a ServiceResult. */
  authorize(
    request: AuthorizeRequest,
    call: CallContext,
  ): Promise<ServiceResult<Authorization>> {
    return postForResult(
      {
        service: 'payment',
        url: `${this.baseUrl}/internal/payments/authorize`,
        body: request,
        correlationId: call.correlationId,
        isValid: isAuthorization,
      },
      this.logger,
    );
  }
}
