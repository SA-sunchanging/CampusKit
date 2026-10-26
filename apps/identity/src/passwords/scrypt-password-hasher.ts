import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { PasswordHasher } from './password-hasher.js';

export interface ScryptCost {
  N: number;
  r: number;
  p: number;
}

/** OWASP recommendation for scrypt. */
export const DEFAULT_SCRYPT_COST: ScryptCost = { N: 2 ** 17, r: 8, p: 1 };

const PREFIX = 'scrypt';
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

function derive(
  password: string,
  salt: Buffer,
  { N, r, p }: ScryptCost,
): Promise<Buffer> {
  // scrypt needs about 128 * N * r bytes; leave headroom above that.
  const maxmem = 256 * N * r;
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, { N, r, p, maxmem }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

/** Stores hashes as `scrypt$N$r$p$<salt base64>$<key base64>`, so old hashes still verify after a cost change. */
@Injectable()
export class ScryptPasswordHasher extends PasswordHasher {
  constructor(private readonly cost: ScryptCost = DEFAULT_SCRYPT_COST) {
    super();
  }

  async hash(password: string): Promise<string> {
    const salt = randomBytes(SALT_LENGTH);
    const key = await derive(password, salt, this.cost);
    const { N, r, p } = this.cost;
    return [
      PREFIX,
      N,
      r,
      p,
      salt.toString('base64'),
      key.toString('base64'),
    ].join('$');
  }

  async verify(password: string, stored: string): Promise<boolean> {
    const parts = stored.split('$');
    if (parts.length !== 6 || parts[0] !== PREFIX) {
      return false;
    }
    const [N, r, p] = parts.slice(1, 4).map(Number);
    const salt = Buffer.from(parts[4], 'base64');
    const expected = Buffer.from(parts[5], 'base64');
    if (![N, r, p].every(Number.isInteger) || expected.length !== KEY_LENGTH) {
      return false;
    }
    const actual = await derive(password, salt, { N, r, p });
    return timingSafeEqual(actual, expected);
  }
}
