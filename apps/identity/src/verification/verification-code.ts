import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

export const CODE_LENGTH = 6;

/** A random six-digit code from the crypto generator, with its leading zeros. */
export function generateCode(): string {
  return String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, '0');
}

/**
 * HMAC-SHA-256 of the code under a server secret, bound to the account. A six-digit code has only
 * a million values, so a salted slow hash would not stop a brute force of a leaked row; the secret,
 * which is not in the database, does. The attempt limit stops guessing through the API.
 */
export function hashCode(
  secret: string,
  accountId: string,
  code: string,
): string {
  return createHmac('sha256', secret)
    .update(`${accountId}:${code}`)
    .digest('hex');
}

/** Whether the code matches the stored hash, compared in constant time. */
export function codeMatches(
  secret: string,
  accountId: string,
  code: string,
  stored: string,
): boolean {
  const actual = Buffer.from(hashCode(secret, accountId, code), 'hex');
  const expected = Buffer.from(stored, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Email verification settings, read from the environment once at startup. */
export class VerificationSettings {
  constructor(
    /** The HMAC key for codes. */
    readonly codeSecret: string,
    /** Demo mode returns the code in the response, because the demo sends no email. */
    readonly demoMode: boolean,
  ) {}

  static fromEnv(env: NodeJS.ProcessEnv = process.env): VerificationSettings {
    return new VerificationSettings(
      env.VERIFICATION_CODE_SECRET ?? 'dev-only-code-secret',
      env.DEMO_MODE === 'true',
    );
  }
}
