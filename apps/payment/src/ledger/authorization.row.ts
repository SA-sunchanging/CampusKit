import type { EntityManager } from 'typeorm';
import type {
  AuthorizationKind,
  AuthorizationStatus,
  ReportedStatus,
} from './authorization.entity.js';

/** An authorizations row as the queries below return it (snake_case). */
export interface AuthorizationRow {
  id: string;
  booking_id: string;
  kind: AuthorizationKind;
  payer_id: string;
  payee_id: string;
  amount: number;
  captured_amount: number;
  released_amount: number;
  status: AuthorizationStatus;
  expires_at: Date;
  created_at: Date;
  updated_at: Date;
}

/** The select list (or RETURNING list) that produces an AuthorizationRow. */
export const AUTHORIZATION_COLUMNS = `id, booking_id, kind, payer_id, payee_id, amount,
  captured_amount, released_amount, status, expires_at, created_at, updated_at`;

/**
 * The authorizations of a booking, FEE before DEPOSIT ('FEE' sorts after 'DEPOSIT'), locked
 * until the transaction ends when lock is true.
 */
export function findAuthorizations(
  tx: Pick<EntityManager, 'query'>,
  bookingId: string,
  lock = false,
): Promise<AuthorizationRow[]> {
  return tx.query(
    `SELECT ${AUTHORIZATION_COLUMNS} FROM authorizations
     WHERE booking_id = $1 ORDER BY kind DESC${lock ? ' FOR UPDATE' : ''}`,
    [bookingId],
  );
}

/**
 * Runs an UPDATE ... RETURNING AUTHORIZATION_COLUMNS and returns the updated rows.
 * TypeORM answers an UPDATE with [rows, affected].
 */
export async function updateAuthorizations(
  tx: EntityManager,
  sql: string,
  params: unknown[],
): Promise<AuthorizationRow[]> {
  const [rows] = (await tx.query(sql, params)) as [AuthorizationRow[], number];
  return rows;
}

export function ofKind(
  rows: AuthorizationRow[],
  kind: AuthorizationKind,
): AuthorizationRow | undefined {
  return rows.find((row) => row.kind === kind);
}

/** The stored status, except that an AUTHORIZED row whose time has run out is EXPIRED. */
export function reportedStatus(
  row: AuthorizationRow,
  now: Date,
): ReportedStatus {
  return row.status === 'AUTHORIZED' && row.expires_at <= now
    ? 'EXPIRED'
    : row.status;
}

/** "fee" or "deposit", for messages. */
export function kindLabel(kind: AuthorizationKind): string {
  return kind === 'FEE' ? 'fee' : 'deposit';
}
