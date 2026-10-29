import {
  BadRequestException,
  ConflictException,
  GoneException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import {
  type DataSource,
  type FindOperator,
  IsNull,
  type Repository,
} from 'typeorm';
import { Account } from '../accounts/account.entity.js';
import type { AccountsService } from '../accounts/accounts.service.js';
import { EmailVerification } from './email-verification.entity.js';
import {
  CODE_TTL_MS,
  EmailVerificationService,
  MAX_ATTEMPTS,
} from './email-verification.service.js';
import { hashCode, VerificationSettings } from './verification-code.js';

const accountId = '00000000-0000-4000-8000-000000000001';
const secret = 'test-secret';
const now = new Date('2026-10-29T05:00:00Z');
const later = (ms: number) => new Date(now.getTime() + ms);

// Plain rows rather than class instances, so the mocks can copy them with a spread.
type AccountRow = Pick<Account, keyof Account>;
type CodeRow = Pick<EmailVerification, keyof EmailVerification>;

const account = (fields: Partial<Account> = {}): AccountRow => ({
  id: accountId,
  email: 'somchai@student.chula.ac.th',
  passwordHash: 'scrypt$hash',
  displayName: 'Somchai',
  role: 'student',
  emailVerifiedAt: null,
  studentStatus: 'UNSUBMITTED',
  payoutProfile: null,
  suspendedAt: null,
  createdAt: new Date('2026-10-26T00:00:00Z'),
  ...fields,
});

const pendingCode = (
  code: string,
  fields: Partial<EmailVerification> = {},
): CodeRow => ({
  accountId,
  codeHash: hashCode(secret, accountId, code),
  expiresAt: later(CODE_TTL_MS),
  attempts: 0,
  createdAt: now,
  ...fields,
});

interface IncrementWhere {
  attempts: FindOperator<number>;
  expiresAt: FindOperator<Date>;
}

function setup({
  stored = null as CodeRow | null,
  demoMode = false,
  found = account() as AccountRow | null,
} = {}) {
  let row = stored ? { ...stored } : null;
  const accounts = {
    getAccount: vi.fn(() =>
      found
        ? Promise.resolve({ ...found })
        : Promise.reject(new NotFoundException('Account not found')),
    ),
  };
  const verifications = {
    findOneBy: vi.fn(() => Promise.resolve(row ? { ...row } : null)),
    upsert: vi.fn((fields: CodeRow) => {
      row = { ...fields };
      return Promise.resolve();
    }),
    // Applies the conditional update the way PostgreSQL would.
    increment: vi.fn((where: IncrementWhere) => {
      const match =
        row !== null &&
        row.attempts < where.attempts.value &&
        row.expiresAt > where.expiresAt.value;
      if (row && match) {
        row = { ...row, attempts: row.attempts + 1 };
      }
      return Promise.resolve({ affected: match ? 1 : 0 });
    }),
    delete: vi.fn(() => {
      row = null;
      return Promise.resolve({ affected: 1 });
    }),
  };
  const accountRepo = { update: vi.fn().mockResolvedValue({ affected: 1 }) };
  const tx = {
    getRepository: vi.fn((entity: unknown) =>
      entity === Account ? accountRepo : verifications,
    ),
  };
  const db = {
    transaction: vi.fn((work: (manager: typeof tx) => unknown) => work(tx)),
  };
  const service = new EmailVerificationService(
    accounts as unknown as AccountsService,
    verifications as unknown as Repository<EmailVerification>,
    db as unknown as DataSource,
    new VerificationSettings(secret, demoMode),
  );
  return { service, verifications, accountRepo, db, row: () => row };
}

describe('EmailVerificationService.issue', () => {
  it('stores a hash of a new code that expires in 15 minutes', async () => {
    const { service, row } = setup();
    const result = await service.issue(accountId, now);
    expect(result).toEqual({ expiresAt: later(CODE_TTL_MS) });
    expect(row()).toMatchObject({
      accountId,
      expiresAt: later(CODE_TTL_MS),
      attempts: 0,
      createdAt: now,
    });
    expect(row()?.codeHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns the code only in demo mode, and it is the stored one', async () => {
    const { service, row } = setup({ demoMode: true });
    const { demoCode } = await service.issue(accountId, now);
    expect(demoCode).toMatch(/^\d{6}$/);
    expect(row()?.codeHash).toBe(hashCode(secret, accountId, demoCode ?? ''));
    expect(row()?.codeHash).not.toContain(demoCode);
  });

  it('answers 429 within a minute of the last code', async () => {
    const { service, verifications } = setup({
      stored: pendingCode('111111'),
    });
    const error = await service
      .issue(accountId, later(45_000))
      .catch((err: unknown) => err);
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(
      HttpStatus.TOO_MANY_REQUESTS,
    );
    expect((error as HttpException).message).toContain('15 seconds');
    expect(verifications.upsert).not.toHaveBeenCalled();
  });

  it('replaces the code after a minute and resets the attempts', async () => {
    const { service, row } = setup({
      stored: pendingCode('111111', { attempts: MAX_ATTEMPTS }),
    });
    await service.issue(accountId, later(60_000));
    expect(row()).toMatchObject({
      attempts: 0,
      createdAt: later(60_000),
      expiresAt: later(60_000 + CODE_TTL_MS),
    });
    expect(row()?.codeHash).not.toBe(pendingCode('111111').codeHash);
  });

  it('answers 409 when the email is already verified', async () => {
    const { service, verifications } = setup({
      found: account({ emailVerifiedAt: now }),
    });
    await expect(service.issue(accountId, now)).rejects.toThrow(
      ConflictException,
    );
    expect(verifications.upsert).not.toHaveBeenCalled();
  });

  it('answers 404 for an unknown account', async () => {
    const { service } = setup({ found: null });
    await expect(service.issue(accountId, now)).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('EmailVerificationService.confirm', () => {
  it('marks the email verified and removes the code', async () => {
    const { service, accountRepo, db, row } = setup({
      stored: pendingCode('042917'),
    });
    const profile = await service.confirm(accountId, '042917', now);
    expect(profile).toMatchObject({ id: accountId, emailVerified: true });
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(accountRepo.update).toHaveBeenCalledWith(
      { id: accountId, emailVerifiedAt: IsNull() },
      { emailVerifiedAt: now },
    );
    expect(row()).toBeNull();
  });

  it('answers 400 for a wrong code, spends an attempt, and keeps the account unverified', async () => {
    const { service, accountRepo, row } = setup({
      stored: pendingCode('042917'),
    });
    await expect(service.confirm(accountId, '000000', now)).rejects.toThrow(
      new BadRequestException('Wrong code; 4 tries left'),
    );
    expect(row()?.attempts).toBe(1);
    expect(accountRepo.update).not.toHaveBeenCalled();
  });

  it('voids the code after five wrong tries, even for the right code', async () => {
    const { service } = setup({ stored: pendingCode('042917') });
    for (let i = 1; i < MAX_ATTEMPTS; i += 1) {
      await expect(service.confirm(accountId, '000000', now)).rejects.toThrow(
        BadRequestException,
      );
    }
    await expect(service.confirm(accountId, '000000', now)).rejects.toThrow(
      'Wrong code; ask for a new one',
    );
    await expect(service.confirm(accountId, '042917', now)).rejects.toThrow(
      GoneException,
    );
  });

  it('accepts the right code on the fifth try', async () => {
    const { service } = setup({
      stored: pendingCode('042917', { attempts: MAX_ATTEMPTS - 1 }),
    });
    await expect(
      service.confirm(accountId, '042917', now),
    ).resolves.toMatchObject({ emailVerified: true });
  });

  it('answers 410 for an expired code', async () => {
    const { service, accountRepo } = setup({ stored: pendingCode('042917') });
    await expect(
      service.confirm(accountId, '042917', later(CODE_TTL_MS)),
    ).rejects.toThrow(GoneException);
    expect(accountRepo.update).not.toHaveBeenCalled();
  });

  it('answers 410 when no code was issued', async () => {
    const { service } = setup();
    await expect(service.confirm(accountId, '042917', now)).rejects.toThrow(
      GoneException,
    );
  });

  it('answers 409 when the email is already verified', async () => {
    const { service, verifications } = setup({
      found: account({ emailVerifiedAt: now }),
      stored: pendingCode('042917'),
    });
    await expect(service.confirm(accountId, '042917', now)).rejects.toThrow(
      ConflictException,
    );
    expect(verifications.increment).not.toHaveBeenCalled();
  });

  it('confirms the code a demo-mode issue returned', async () => {
    const { service } = setup({ demoMode: true });
    const { demoCode } = await service.issue(accountId, now);
    await expect(
      service.confirm(accountId, demoCode ?? '', later(1000)),
    ).resolves.toMatchObject({ emailVerified: true });
  });
});
