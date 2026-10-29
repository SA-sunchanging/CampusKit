import { randomInt, timingSafeEqual } from 'node:crypto';

/** A pickup or return code: exactly six digits. */
export const CODE_PATTERN = /^[0-9]{6}$/;

/** Draws an integer in [min, max); crypto.randomInt by default. */
export type DrawInteger = (min: number, max: number) => number;

/** A new six-digit code, zero-padded, drawn from a cryptographic random source. */
export function generateCode(
  draw: DrawInteger = (min, max) => randomInt(min, max),
): string {
  return draw(0, 1_000_000).toString().padStart(6, '0');
}

/**
 * Whether the code given by the caller is the stored one. Anything that is not six digits never
 * matches; two six-digit codes are compared in constant time, so the time taken does not tell
 * how many leading digits were right.
 */
export function codesMatch(expected: string, given: unknown): boolean {
  if (
    typeof given !== 'string' ||
    !CODE_PATTERN.test(expected) ||
    !CODE_PATTERN.test(given)
  ) {
    return false;
  }
  return timingSafeEqual(Buffer.from(expected), Buffer.from(given));
}
