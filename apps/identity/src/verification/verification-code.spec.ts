import {
  codeMatches,
  generateCode,
  hashCode,
  VerificationSettings,
} from './verification-code.js';

const secret = 'test-secret';
const accountId = '00000000-0000-4000-8000-000000000001';
const otherId = '00000000-0000-4000-8000-000000000002';

describe('generateCode', () => {
  it('returns six digits', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(generateCode()).toMatch(/^\d{6}$/);
    }
  });

  it('varies between calls', () => {
    const codes = new Set(Array.from({ length: 50 }, generateCode));
    expect(codes.size).toBeGreaterThan(40);
  });
});

describe('hashCode', () => {
  it('is a SHA-256 hex digest that does not contain the code', () => {
    const hash = hashCode(secret, accountId, '012345');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain('012345');
  });

  it('depends on the secret and the account', () => {
    const hash = hashCode(secret, accountId, '012345');
    expect(hashCode('other-secret', accountId, '012345')).not.toBe(hash);
    expect(hashCode(secret, otherId, '012345')).not.toBe(hash);
  });
});

describe('codeMatches', () => {
  const stored = hashCode(secret, accountId, '012345');

  it('accepts the code that was hashed', () => {
    expect(codeMatches(secret, accountId, '012345', stored)).toBe(true);
  });

  it.each([
    ['a wrong code', secret, accountId, '012346'],
    ['the right code for another account', secret, otherId, '012345'],
    ['another secret', 'other-secret', accountId, '012345'],
  ])('refuses %s', (_case, key, account, code) => {
    expect(codeMatches(key, account, code, stored)).toBe(false);
  });

  it.each(['', 'abc', stored.slice(2)])(
    'returns false instead of throwing for the stored value %j',
    (bad) => {
      expect(codeMatches(secret, accountId, '012345', bad)).toBe(false);
    },
  );
});

describe('VerificationSettings.fromEnv', () => {
  it('turns demo mode on only for DEMO_MODE=true', () => {
    expect(VerificationSettings.fromEnv({ DEMO_MODE: 'true' }).demoMode).toBe(
      true,
    );
    for (const value of [undefined, 'false', '1', 'TRUE']) {
      expect(VerificationSettings.fromEnv({ DEMO_MODE: value }).demoMode).toBe(
        false,
      );
    }
  });

  it('reads the code secret, with a development default', () => {
    expect(
      VerificationSettings.fromEnv({ VERIFICATION_CODE_SECRET: 's' })
        .codeSecret,
    ).toBe('s');
    expect(VerificationSettings.fromEnv({}).codeSecret).toBe(
      'dev-only-code-secret',
    );
  });
});
