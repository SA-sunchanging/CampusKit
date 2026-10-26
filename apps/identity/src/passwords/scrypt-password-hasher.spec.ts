import { ScryptPasswordHasher } from './scrypt-password-hasher.js';

// A low cost keeps the tests fast; the format and logic are the same as in production.
const hasher = new ScryptPasswordHasher({ N: 2 ** 10, r: 8, p: 1 });

describe('ScryptPasswordHasher', () => {
  it('verifies the password it hashed', async () => {
    const stored = await hasher.hash('correct horse');
    expect(await hasher.verify('correct horse', stored)).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const stored = await hasher.hash('correct horse');
    expect(await hasher.verify('wrong horse', stored)).toBe(false);
  });

  it('prefixes the hash with the algorithm and its cost', async () => {
    const stored = await hasher.hash('correct horse');
    expect(stored).toMatch(/^scrypt\$1024\$8\$1\$[^$]+\$[^$]+$/);
    expect(stored).not.toContain('correct horse');
  });

  it('salts each hash differently', async () => {
    expect(await hasher.hash('same')).not.toBe(await hasher.hash('same'));
  });

  it('verifies a hash made with a different cost', async () => {
    const stored = await new ScryptPasswordHasher({
      N: 2 ** 11,
      r: 8,
      p: 1,
    }).hash('pw');
    expect(await hasher.verify('pw', stored)).toBe(true);
  });

  it.each([
    '',
    'argon2$abc',
    'scrypt$x$8$1$c2FsdA==$a2V5',
    'scrypt$1024$8$1$c2FsdA==$c2hvcnQ=',
  ])('returns false for an unreadable hash %j', async (stored) => {
    expect(await hasher.verify('pw', stored)).toBe(false);
  });
});
