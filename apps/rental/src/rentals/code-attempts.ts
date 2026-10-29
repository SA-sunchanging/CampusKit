import type { EntityManager } from 'typeorm';
import { codesMatch, generateCode } from './codes.js';
import type { RentalRow } from './rental.row.js';

/** After this many wrong codes in a row the code is replaced with a new one. */
export const MAX_CODE_ATTEMPTS = 5;

/** The pickup code (held by the owner) or the return code (held by the renter). */
export type CodeKind = 'pickup' | 'return';

const COLUMNS = {
  pickup: { code: 'pickup_code', attempts: 'pickup_attempts' },
  return: { code: 'return_code', attempts: 'return_attempts' },
} as const;

/** match: the code is right; wrong: one more attempt counted; replaced: a new code was made. */
export type CodeCheck = 'match' | 'wrong' | 'replaced';

/**
 * The counter and code after one more wrong code. The attempt that reaches MAX_CODE_ATTEMPTS
 * replaces the code and starts the counter again, so guessing never gets past a few tries.
 */
export function afterWrongCode(
  attempts: number,
  code: string,
  newCode: () => string = generateCode,
): { attempts: number; code: string; replaced: boolean } {
  const next = attempts + 1;
  return next >= MAX_CODE_ATTEMPTS
    ? { attempts: 0, code: newCode(), replaced: true }
    : { attempts: next, code, replaced: false };
}

/**
 * Compares the given code with the stored one on a row locked by the caller's transaction.
 * A wrong code is counted (and the code replaced at MAX_CODE_ATTEMPTS) in that transaction;
 * the caller must commit it before answering 400, or the attempt would not count.
 */
export async function checkCode(
  tx: Pick<EntityManager, 'query'>,
  row: RentalRow,
  kind: CodeKind,
  given: unknown,
  newCode: () => string = generateCode,
): Promise<CodeCheck> {
  const columns = COLUMNS[kind];
  if (codesMatch(row[columns.code], given)) {
    return 'match';
  }
  const next = afterWrongCode(
    row[columns.attempts],
    row[columns.code],
    newCode,
  );
  await tx.query(
    `UPDATE rentals
     SET ${columns.attempts} = $2, ${columns.code} = $3, updated_at = now()
     WHERE id = $1`,
    [row.id, next.attempts, next.code],
  );
  return next.replaced ? 'replaced' : 'wrong';
}
