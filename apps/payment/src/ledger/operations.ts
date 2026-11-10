import { ConflictException, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { DataSource, EntityManager } from 'typeorm';
import {
  type AuthorizationRow,
  findAuthorizations,
} from './authorization.row.js';
import type { LedgerOperation } from './ledger-entry.entity.js';

/** What every ledger request carries: the caller's stable operation ID and the booking. */
export interface OperationRequest {
  operationId: string;
  bookingId: string;
}

/** The change an operation makes, given the booking's authorizations locked FOR UPDATE. */
export type ApplyOperation<T> = (
  tx: EntityManager,
  authorizations: AuthorizationRow[],
) => Promise<T>;

const logger = new Logger('LedgerOperations');

/** JSON with object keys in sorted order at every level, so equal requests give equal text. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const fields = Object.entries(value)
      .filter(([, field]) => field !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, field]) => `${JSON.stringify(key)}:${canonicalJson(field)}`);
    return `{${fields.join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/** SHA-256 (hex) of the operation and its request body. */
export function requestHash(
  operation: LedgerOperation,
  request: object,
): string {
  return createHash('sha256')
    .update(canonicalJson({ operation, request }))
    .digest('hex');
}

interface StoredEntry {
  request_hash: string;
  result: unknown;
}

/**
 * Runs one ledger operation exactly once per operation ID, in one transaction:
 * 1. lock the booking, including when it has no authorization rows yet, then the operation ID;
 * 2. if a ledger entry with this ID exists, return its stored result when the request is the
 *    same, or answer 409 when the ID was used for another request;
 * 3. otherwise lock the booking's authorizations, apply the change and store the entry with
 *    its result.
 * A refusal thrown by apply rolls the transaction back, so nothing is stored and a corrected
 * retry with the same ID can still succeed. The result must be plain JSON.
 */
export function runOperation<T, R extends OperationRequest>(
  db: DataSource,
  operation: LedgerOperation,
  request: R,
  apply: ApplyOperation<T>,
  validateReplay?: (tx: EntityManager, result: T) => Promise<void>,
): Promise<T> {
  const hash = requestHash(operation, request);
  return db.transaction(async (tx) => {
    await tx.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
      `payment:booking:${request.bookingId.toLowerCase()}`,
    ]);
    await tx.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
      `payment:operation:${request.operationId}`,
    ]);
    const [stored] = (await tx.query(
      `SELECT request_hash, result FROM ledger_entries WHERE operation_id = $1`,
      [request.operationId],
    )) as StoredEntry[];
    if (stored) {
      if (stored.request_hash !== hash) {
        throw new ConflictException(
          'operationId was already used for a different request',
        );
      }
      await validateReplay?.(tx, stored.result as T);
      logger.log(`${operation} ${request.operationId} replayed`);
      return stored.result as T;
    }
    const authorizations = await findAuthorizations(
      tx,
      request.bookingId,
      true,
    );
    const result = await apply(tx, authorizations);
    await tx.query(
      `INSERT INTO ledger_entries
         (operation_id, operation, booking_id, request_hash, result)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        request.operationId,
        operation,
        request.bookingId,
        hash,
        JSON.stringify(result),
      ],
    );
    return result;
  });
}
