import { ConflictException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, type EntityManager } from 'typeorm';
import { CaptureResponse } from '../internal/capture.response.js';
import {
  AUTHORIZATION_COLUMNS,
  type AuthorizationRow,
  ofKind,
  reportedStatus,
  updateAuthorizations,
} from './authorization.row.js';
import { type OperationRequest, runOperation } from './operations.js';

/** Body of POST /internal/payments/capture. */
export interface CaptureRequest extends OperationRequest {
  /** The rental fee in satang; must equal the fee authorization, or be 0 when there is none. */
  amount: number;
}

export interface CaptureResult {
  bookingId: string;
  kind: 'FEE';
  capturedAmount: number;
  /** NOT_REQUIRED when the booking has no fee and the amount is 0. */
  status: 'CAPTURED' | 'NOT_REQUIRED';
}

/** Throws 409 unless the fee authorization can be captured for this amount now. */
export function checkCapturable(
  fee: AuthorizationRow,
  amount: number,
  now: Date,
): void {
  const status = reportedStatus(fee, now);
  if (status === 'EXPIRED') {
    throw new ConflictException('The fee authorization has expired');
  }
  if (status !== 'AUTHORIZED') {
    throw new ConflictException(`The fee authorization is ${status}`);
  }
  if (amount !== fee.amount) {
    throw new ConflictException(
      `The amount ${amount} does not match the fee authorization of ${fee.amount}`,
    );
  }
}

/** Takes the rental fee at pickup (called by Rental). The deposit stays authorized. */
@Injectable()
export class CaptureService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async capture(
    request: CaptureRequest,
    now = new Date(),
  ): Promise<CaptureResponse> {
    const result = await runOperation(this.db, 'CAPTURE', request, (tx, rows) =>
      this.apply(tx, rows, request, now),
    );
    return CaptureResponse.of(result);
  }

  private async apply(
    tx: EntityManager,
    rows: AuthorizationRow[],
    request: CaptureRequest,
    now: Date,
  ): Promise<CaptureResult> {
    const base = { bookingId: request.bookingId, kind: 'FEE' as const };
    const fee = ofKind(rows, 'FEE');
    if (!fee) {
      if (request.amount === 0) {
        return { ...base, capturedAmount: 0, status: 'NOT_REQUIRED' };
      }
      throw new ConflictException('The booking has no fee authorization');
    }
    checkCapturable(fee, request.amount, now);
    const [captured] = await updateAuthorizations(
      tx,
      `UPDATE authorizations
       SET status = 'CAPTURED', captured_amount = $2, updated_at = now()
       WHERE id = $1 AND status = 'AUTHORIZED'
       RETURNING ${AUTHORIZATION_COLUMNS}`,
      [fee.id, request.amount],
    );
    return {
      ...base,
      capturedAmount: captured.captured_amount,
      status: 'CAPTURED',
    };
  }
}
