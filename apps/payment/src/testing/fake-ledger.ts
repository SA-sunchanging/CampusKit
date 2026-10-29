import type { DataSource } from 'typeorm';
import type { AuthorizationRow } from '../ledger/authorization.row.js';

/** IDs and times shared by the payment unit specs. */
export const BOOKING_ID = '22222222-2222-4222-8222-222222222222';
export const OWNER_ID = '00000000-0000-4000-8000-000000000001';
export const RENTER_ID = '00000000-0000-4000-8000-000000000002';
export const NOW = new Date('2026-10-29T05:00:00Z');

export function authorizationRow(
  overrides: Partial<AuthorizationRow> = {},
): AuthorizationRow {
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    booking_id: BOOKING_ID,
    kind: 'FEE',
    payer_id: RENTER_ID,
    payee_id: OWNER_ID,
    amount: 6000,
    captured_amount: 0,
    released_amount: 0,
    status: 'AUTHORIZED',
    expires_at: new Date('2026-11-28T05:00:00Z'),
    created_at: new Date('2026-10-29T04:00:00Z'),
    updated_at: new Date('2026-10-29T04:00:00Z'),
    ...overrides,
  };
}

export interface StoredEntry {
  operation: string;
  booking_id: string;
  request_hash: string;
  result: unknown;
}

export interface FakeLedgerState {
  authorizations: AuthorizationRow[];
  entries: Map<string, StoredEntry>;
  queries: { sql: string; params: unknown[] }[];
}

/** Answers one statement, or returns undefined to fall through to the ledger defaults. */
export type FakeHandler = (
  sql: string,
  params: unknown[],
  state: FakeLedgerState,
) => unknown;

/**
 * A fake payment_db for unit specs, in the Booking style: it branches on SQL text. It answers
 * the runner's statements (advisory lock, ledger lookup and insert, authorizations lookup);
 * handle answers the operation's own statements. Every statement is recorded in queries.
 */
export function fakeLedger(
  initial: AuthorizationRow[] = [],
  handle: FakeHandler = () => undefined,
) {
  const state: FakeLedgerState = {
    authorizations: initial.map((row) => ({ ...row })),
    entries: new Map(),
    queries: [],
  };
  const answer = (sql: string, params: unknown[]): unknown => {
    const handled = handle(sql, params, state);
    if (handled !== undefined) {
      return handled;
    }
    if (sql.includes('pg_advisory_xact_lock')) {
      return [{}];
    }
    if (sql.includes('INSERT INTO ledger_entries')) {
      state.entries.set(params[0] as string, {
        operation: params[1] as string,
        booking_id: params[2] as string,
        request_hash: params[3] as string,
        result: JSON.parse(params[4] as string),
      });
      return [];
    }
    if (sql.includes('FROM ledger_entries')) {
      const entry = state.entries.get(params[0] as string);
      return entry ? [entry] : [];
    }
    if (sql.includes('FROM authorizations')) {
      return state.authorizations.filter((row) => row.booking_id === params[0]);
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const tx = {
    query: (sql: string, params: unknown[] = []) => {
      state.queries.push({ sql, params });
      try {
        return Promise.resolve(answer(sql, params));
      } catch (err) {
        return Promise.reject(err as Error);
      }
    },
  };
  const db = {
    transaction: (work: (manager: typeof tx) => Promise<unknown>) => work(tx),
    query: tx.query,
  };
  return { state, tx, db: db as unknown as DataSource };
}

/** The error a promise rejects with, or undefined when it resolves. */
export async function errorOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (err) {
    return err;
  }
  return undefined;
}
