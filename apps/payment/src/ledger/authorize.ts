import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, type EntityManager } from 'typeorm';
import { AuthorizeResponse } from '../internal/authorize.response.js';
import type { AuthorizationKind } from './authorization.entity.js';
import { type AuthorizationRow, kindLabel } from './authorization.row.js';
import { authorizationTtlDays, expiresAt } from './authorization-ttl.js';
import { type OperationRequest, runOperation } from './operations.js';

/** Body of POST /internal/payments/authorize. */
export interface AuthorizeRequest extends OperationRequest {
  /** The renter. */
  payerId: string;
  /** The listing owner. */
  payeeId: string;
  kind: AuthorizationKind;
  /** Integer satang, more than zero. */
  amount: number;
}

interface Created {
  id: string;
  status: string;
}

/** Refuses a second hold of the same kind, or one between other people than the first. */
function checkExisting(
  request: AuthorizeRequest,
  rows: AuthorizationRow[],
): void {
  if (rows.some((row) => row.kind === request.kind)) {
    throw new ConflictException(
      `The booking already has a ${kindLabel(request.kind)} authorization`,
    );
  }
  if (
    rows.some(
      (row) =>
        row.payer_id !== request.payerId || row.payee_id !== request.payeeId,
    )
  ) {
    throw new ConflictException(
      "The booking's other authorization has a different payer or payee",
    );
  }
}

/** Holds the renter's rental fee or deposit for a booking (called by Booking on approval). */
@Injectable()
export class AuthorizeService {
  private readonly ttlDays = authorizationTtlDays();

  constructor(@InjectDataSource() private readonly db: DataSource) {}

  /**
   * Creates one AUTHORIZED hold per booking and kind that expires after the configured number
   * of days. Repeating the same request with the same operationId returns the same reply.
   */
  async authorize(
    request: AuthorizeRequest,
    now = new Date(),
  ): Promise<AuthorizeResponse> {
    if (request.payerId === request.payeeId) {
      throw new BadRequestException(
        'The payer and the payee must be different people',
      );
    }
    const created = await runOperation(
      this.db,
      'AUTHORIZE',
      request,
      (tx, rows) => {
        checkExisting(request, rows);
        return this.insert(tx, request, now);
      },
    );
    return AuthorizeResponse.of(created);
  }

  private async insert(
    tx: EntityManager,
    request: AuthorizeRequest,
    now: Date,
  ): Promise<Created> {
    // ON CONFLICT: a concurrent request with another operationId may have inserted the same
    // kind after this transaction read the (then empty) authorizations.
    const [row] = (await tx.query(
      `INSERT INTO authorizations
         (booking_id, kind, payer_id, payee_id, amount, status, expires_at)
       VALUES ($1, $2, $3, $4, $5, 'AUTHORIZED', $6)
       ON CONFLICT (booking_id, kind) DO NOTHING
       RETURNING id, status`,
      [
        request.bookingId,
        request.kind,
        request.payerId,
        request.payeeId,
        request.amount,
        expiresAt(now, this.ttlDays),
      ],
    )) as Created[];
    if (!row) {
      throw new ConflictException(
        `The booking already has a ${kindLabel(request.kind)} authorization`,
      );
    }
    return { id: row.id, status: row.status };
  }
}
