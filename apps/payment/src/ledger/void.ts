import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { VoidResponse } from '../internal/void.response.js';
import type { AuthorizationKind } from './authorization.entity.js';
import { type OperationRequest, runOperation } from './operations.js';

/** Body of POST /internal/payments/void. */
export type VoidRequest = OperationRequest;

export interface VoidResult {
  bookingId: string;
  /** The kinds voided by this operation, FEE before DEPOSIT. */
  voided: AuthorizationKind[];
}

/**
 * Releases every open (AUTHORIZED, also when expired) hold of a booking that will not go
 * ahead. CAPTURED and SETTLED rows stay as they are; refunds are out of scope.
 */
@Injectable()
export class VoidService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async voidOpen(request: VoidRequest): Promise<VoidResponse> {
    const result = await runOperation(
      this.db,
      'VOID',
      request,
      async (tx, rows): Promise<VoidResult> => {
        const open = rows.filter((row) => row.status === 'AUTHORIZED');
        if (open.length > 0) {
          await tx.query(
            `UPDATE authorizations
             SET status = 'VOIDED', released_amount = amount, updated_at = now()
             WHERE id = ANY($1::uuid[]) AND status = 'AUTHORIZED'`,
            [open.map((row) => row.id)],
          );
        }
        return {
          bookingId: request.bookingId,
          voided: open.map((row) => row.kind),
        };
      },
    );
    return VoidResponse.of(result);
  }
}
