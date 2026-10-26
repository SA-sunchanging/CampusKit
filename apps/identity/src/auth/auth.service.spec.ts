import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import type { Account } from '../accounts/account.entity.js';
import type { AccountsService } from '../accounts/accounts.service.js';
import type { PasswordHasher } from '../passwords/password-hasher.js';
import { AuthService, tokenLifetime } from './auth.service.js';

const makeAccount = (suspendedAt: Date | null = null) =>
  ({
    id: 'a1',
    passwordHash: 'scrypt$real',
    role: 'student',
    suspendedAt,
  }) as Account;
const account = makeAccount();

function setup(found: Account | null, passwordOk: boolean) {
  const accounts = { findByEmail: vi.fn().mockResolvedValue(found) };
  const hasher = {
    hash: vi.fn().mockResolvedValue('scrypt$dummy'),
    verify: vi.fn().mockResolvedValue(passwordOk),
  };
  const jwt = { signAsync: vi.fn().mockResolvedValue('signed.jwt') };
  const service = new AuthService(
    accounts as unknown as AccountsService,
    hasher as PasswordHasher,
    jwt as unknown as JwtService,
  );
  return { hasher, jwt, service };
}

const dto = { email: 'somchai@student.chula.ac.th', password: 'correct horse' };

describe('AuthService.login', () => {
  it('issues a JWT with only sub and role', async () => {
    const { jwt, service } = setup(account, true);
    await expect(service.login(dto)).resolves.toEqual({
      accessToken: 'signed.jwt',
      tokenType: 'Bearer',
      expiresIn: 3600,
    });
    expect(jwt.signAsync).toHaveBeenCalledWith(
      { sub: 'a1', role: 'student' },
      { expiresIn: 3600 },
    );
  });

  it('rejects a wrong password with the generic message', async () => {
    const { hasher, service } = setup(account, false);
    await expect(service.login(dto)).rejects.toThrow(
      new UnauthorizedException('Invalid email or password'),
    );
    expect(hasher.verify).toHaveBeenCalledWith('correct horse', 'scrypt$real');
  });

  it('rejects an unknown email the same way, after hashing a dummy password', async () => {
    const { hasher, jwt, service } = setup(null, false);
    await expect(service.login(dto)).rejects.toThrow(
      new UnauthorizedException('Invalid email or password'),
    );
    expect(hasher.verify).toHaveBeenCalledWith('correct horse', 'scrypt$dummy');
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('never logs in an unknown email, even if the dummy hash matched', async () => {
    const { service } = setup(null, true);
    await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
  });

  it('creates the dummy hash only once', async () => {
    const { hasher, service } = setup(null, false);
    await service.login(dto).catch(() => undefined);
    await service.login(dto).catch(() => undefined);
    expect(hasher.hash).toHaveBeenCalledTimes(1);
  });

  it('refuses a suspended account with the right password', async () => {
    const { jwt, service } = setup(makeAccount(new Date()), true);
    await expect(service.login(dto)).rejects.toThrow(ForbiddenException);
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('does not reveal a suspension to a wrong password', async () => {
    const { service } = setup(makeAccount(new Date()), false);
    await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
  });
});

describe('tokenLifetime', () => {
  it.each([
    [undefined, 3600],
    ['', 3600],
    ['900', 900],
    ['1h', 3600],
    ['-5', 3600],
    ['1.5', 3600],
  ])('reads %j as %i seconds', (env, expected) => {
    expect(tokenLifetime(env)).toBe(expected);
  });
});
