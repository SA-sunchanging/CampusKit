import type { EventEnvelope } from '@app/contracts';
import type { DataSource } from 'typeorm';
import type { RentalRow } from '../rentals/rental.row.js';

/** The time a fake UPDATE writes for now(). */
export const DB_NOW = new Date('2026-10-29T05:00:00.500Z');

export interface Statement {
  sql: string;
  params: unknown[];
}

/**
 * A rental_db with one rental, for unit specs. It understands the statements the handover
 * services send: SELECT by id or booking_id (with or without FOR UPDATE) and
 * `UPDATE rentals SET col = $n | 'text' | 0 | NULL | now(), ... WHERE id = $1 [AND status = 'X']
 * [RETURNING ...]`, which it applies only when the WHERE matches, and the outbox INSERT. A
 * transaction whose callback throws puts the row and the outbox back as they were.
 */
export class FakeRentalDb {
  readonly statements: Statement[] = [];
  private current: RentalRow | undefined;
  private readonly outbox: EventEnvelope[] = [];

  constructor(row?: RentalRow) {
    this.current = row ? { ...row } : undefined;
  }

  /** The stored row as it is now. */
  get row(): RentalRow | undefined {
    return this.current ? { ...this.current } : undefined;
  }

  /** Replaces the stored row, for example to play a concurrent request. */
  set(row: RentalRow): void {
    this.current = { ...row };
  }

  /** The SQL of every UPDATE sent so far, in order. */
  updates(): string[] {
    return this.statements
      .map((statement) => statement.sql)
      .filter((sql) => sql.trimStart().startsWith('UPDATE'));
  }

  /** The envelopes written to outbox_events and kept, in order. */
  events(): EventEnvelope[] {
    return [...this.outbox];
  }

  get dataSource(): DataSource {
    const query = (sql: string, params: unknown[] = []) =>
      this.query(sql, params);
    const transaction = async (
      work: (tx: { query: typeof query }) => Promise<unknown>,
    ) => {
      const before = this.current ? { ...this.current } : undefined;
      const written = this.outbox.length;
      try {
        return await work({ query });
      } catch (err) {
        this.current = before;
        this.outbox.length = written;
        throw err;
      }
    };
    return { query, transaction } as unknown as DataSource;
  }

  private query(sql: string, params: unknown[]): Promise<unknown> {
    this.statements.push({ sql, params });
    const text = sql.trim();
    if (text.startsWith('SELECT') && text.includes('WHERE id = $1')) {
      const found = this.current?.id === params[0];
      return Promise.resolve(
        found && this.current ? [{ ...this.current }] : [],
      );
    }
    if (text.startsWith('SELECT') && text.includes('WHERE booking_id = $1')) {
      const found = this.current?.booking_id === params[0];
      return Promise.resolve(
        found && this.current ? [{ ...this.current }] : [],
      );
    }
    if (text.startsWith('UPDATE rentals')) {
      return Promise.resolve(this.update(text, params));
    }
    if (text.startsWith('INSERT INTO outbox_events')) {
      this.outbox.push(JSON.parse(params[2] as string) as EventEnvelope);
      return Promise.resolve([]);
    }
    return Promise.reject(new Error(`Unexpected SQL: ${sql}`));
  }

  /** Applies an UPDATE and answers like TypeORM: [rows, affected]. */
  private update(sql: string, params: unknown[]): [RentalRow[], number] {
    const match =
      /SET\s+([\s\S]+?)\s+WHERE\s+id = \$1(?:\s+AND\s+status = '(\w+)')?/.exec(
        sql,
      );
    if (!match) {
      throw new Error(`Unexpected UPDATE: ${sql}`);
    }
    const [, assignments, status] = match;
    const row = this.current;
    if (!row || row.id !== params[0] || (status && row.status !== status)) {
      return [[], 0];
    }
    const changed: Record<string, unknown> = { ...row };
    for (const assignment of assignments.split(',')) {
      const [column, value] = assignment.split('=').map((part) => part.trim());
      changed[column] = valueOf(value, params);
    }
    this.current = changed as unknown as RentalRow;
    return [[{ ...this.current }], 1];
  }
}

function valueOf(expression: string, params: unknown[]): unknown {
  if (expression.startsWith('$')) {
    return params[Number(expression.slice(1)) - 1];
  }
  if (/^[0-9]+$/.test(expression)) {
    return Number(expression);
  }
  if (expression === 'NULL') {
    return null;
  }
  if (expression === 'now()') {
    return DB_NOW;
  }
  if (/^'.*'$/.test(expression)) {
    return expression.slice(1, -1);
  }
  throw new Error(`Unexpected value: ${expression}`);
}
