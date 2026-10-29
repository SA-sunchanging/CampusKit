import { Injectable, Logger } from '@nestjs/common';
import type { CallContext } from './call-context.js';
import { postForResult, type ServiceResult } from './http-call.js';

/** Body of POST /internal/payments/capture (docs/architecture/services.md). */
export interface CaptureRequest {
  /** Stable per rental, so a retried pickup never charges twice. */
  operationId: string;
  bookingId: string;
  /** The rental fee, integer satang. */
  amount: number;
}

/** Reply of POST /internal/payments/capture. */
export interface Capture {
  bookingId: string;
  kind: string;
  capturedAmount: number;
  /** CAPTURED, or NOT_REQUIRED when the booking has no fee. */
  status: string;
}

/** Body of POST /internal/payments/settle. */
export interface SettleRequest {
  /** Stable per rental, so a retried return never settles twice. */
  operationId: string;
  bookingId: string;
  /** The booking's deposit, integer satang. */
  deposit: number;
  /** The late fee stored at the return, integer satang. */
  lateFee: number;
}

/** Reply of POST /internal/payments/settle. */
export interface Settlement {
  bookingId: string;
  lateFeeCharged: number;
  depositReleased: number;
  payout: number;
}

function isCapture(body: unknown): body is Capture {
  const value = body as Partial<Capture> | undefined;
  return (
    typeof value?.bookingId === 'string' &&
    typeof value.capturedAmount === 'number' &&
    typeof value.status === 'string'
  );
}

function isSettlement(body: unknown): body is Settlement {
  const value = body as Partial<Settlement> | undefined;
  return (
    typeof value?.bookingId === 'string' &&
    typeof value.lateFeeCharged === 'number' &&
    typeof value.depositReleased === 'number' &&
    typeof value.payout === 'number'
  );
}

/** Calls Payment's internal capture and settle endpoints. */
@Injectable()
export class PaymentClient {
  private readonly logger = new Logger(PaymentClient.name);
  private readonly baseUrl = process.env.PAYMENT_URL ?? 'http://localhost:3004';

  /** Takes the rental fee at pickup. Never throws; a failure comes back as a ServiceResult. */
  capture(
    request: CaptureRequest,
    call: CallContext,
  ): Promise<ServiceResult<Capture>> {
    return postForResult(
      {
        service: 'payment',
        url: `${this.baseUrl}/internal/payments/capture`,
        body: request,
        correlationId: call.correlationId,
        isValid: isCapture,
      },
      this.logger,
    );
  }

  /** Settles the deposit and late fee after the return. Never throws. */
  settle(
    request: SettleRequest,
    call: CallContext,
  ): Promise<ServiceResult<Settlement>> {
    return postForResult(
      {
        service: 'payment',
        url: `${this.baseUrl}/internal/payments/settle`,
        body: request,
        correlationId: call.correlationId,
        isValid: isSettlement,
      },
      this.logger,
    );
  }
}
