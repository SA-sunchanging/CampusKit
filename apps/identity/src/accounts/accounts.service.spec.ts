import { ConflictException } from '@nestjs/common';
import { QueryFailedError, type Repository } from 'typeorm';
import type { PasswordHasher } from '../passwords/password-hasher.js';
import type { Account } from './account.entity.js';
import { AccountsService } from './accounts.service.js';

const savedAccount = (fields: Partial<Account>): Account => ({
  id: 'a1',
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

function setup() {
  const repo = {
    existsBy: vi.fn().mockResolvedValue(false),
    create: vi.fn((fields: Partial<Account>) => fields),
    save: vi.fn((fields: Partial<Account>) =>
      Promise.resolve(savedAccount(fields)),
    ),
    findOneBy: vi.fn().mockResolvedValue(null),
  };
  const hasher = {
    hash: vi.fn().mockResolvedValue('scrypt$hash'),
    verify: vi.fn(),
  };
  const service = new AccountsService(
    repo as unknown as Repository<Account>,
    hasher as PasswordHasher,
  );
  return { repo, hasher, service };
}

const dto = {
  email: '  Somchai@Student.Chula.ac.th ',
  password: 'correct horse',
  displayName: ' Somchai ',
};

describe('AccountsService.register', () => {
  it('stores a normalized email, a hashed password, and the student role', async () => {
    const { repo, hasher, service } = setup();
    await service.register(dto);
    expect(hasher.hash).toHaveBeenCalledWith('correct horse');
    expect(repo.existsBy).toHaveBeenCalledWith({
      email: 'somchai@student.chula.ac.th',
    });
    expect(repo.create).toHaveBeenCalledWith({
      email: 'somchai@student.chula.ac.th',
      passwordHash: 'scrypt$hash',
      displayName: 'Somchai',
      role: 'student',
      studentStatus: 'UNSUBMITTED',
    });
  });

  it('returns the profile without the password hash', async () => {
    const { service } = setup();
    const profile = await service.register(dto);
    expect(profile).toEqual({
      id: 'a1',
      email: 'somchai@student.chula.ac.th',
      displayName: 'Somchai',
      role: 'student',
      emailVerified: false,
      studentStatus: 'UNSUBMITTED',
      createdAt: new Date('2026-10-26T00:00:00Z'),
    });
    expect(JSON.stringify(profile)).not.toContain('hash');
  });

  it('rejects an email that is already registered', async () => {
    const { repo, service } = setup();
    repo.existsBy.mockResolvedValue(true);
    await expect(service.register(dto)).rejects.toThrow(ConflictException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('turns a concurrent duplicate (unique violation) into a conflict', async () => {
    const { repo, service } = setup();
    repo.save.mockRejectedValue(
      new QueryFailedError(
        'INSERT',
        [],
        Object.assign(new Error('dup'), { code: '23505' }),
      ),
    );
    await expect(service.register(dto)).rejects.toThrow(ConflictException);
  });

  it('passes other database errors through', async () => {
    const { repo, service } = setup();
    const err = new Error('connection lost');
    repo.save.mockRejectedValue(err);
    await expect(service.register(dto)).rejects.toBe(err);
  });
});
