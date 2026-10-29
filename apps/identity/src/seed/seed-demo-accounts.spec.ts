import type { DataSource } from 'typeorm';
import type { Account } from '../accounts/account.entity.js';
import { checkEligibility } from '../eligibility/eligibility.js';
import type { PasswordHasher } from '../passwords/password-hasher.js';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from './demo-accounts.js';
import { DemoEmailTakenError, seedDemoAccounts } from './seed-demo-accounts.js';

type Row = Omit<Account, 'createdAt'>;

function setup(existing: Partial<Account>[] = []) {
  const repo = {
    findBy: vi.fn().mockResolvedValue(existing),
    upsert: vi.fn().mockResolvedValue(undefined),
  };
  const manager = { getRepository: vi.fn(() => repo) };
  const dataSource = {
    transaction: vi.fn((work: (m: typeof manager) => Promise<unknown>) =>
      work(manager),
    ),
  };
  const hasher = {
    hash: vi.fn().mockResolvedValue('scrypt$hash'),
    verify: vi.fn(),
  };
  const seed = () =>
    seedDemoAccounts(
      dataSource as unknown as Pick<DataSource, 'transaction'>,
      hasher as PasswordHasher,
    );
  const upserted = (call = 0): Row[] =>
    (repo.upsert.mock.calls[call] as [Row[], string[]])[0];
  return { repo, dataSource, hasher, seed, upserted };
}

const byEmail = (rows: Row[], email: string): Row => {
  const row = rows.find((r) => r.email === email);
  if (!row) throw new Error(`no row for ${email}`);
  return row;
};

describe('seedDemoAccounts', () => {
  it('upserts the three demo accounts on their fixed ids in one transaction', async () => {
    const { repo, dataSource, seed, upserted } = setup();
    const seeded = await seed();
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(repo.upsert).toHaveBeenCalledWith(expect.any(Array), ['id']);
    expect(upserted().map((r) => [r.id, r.email, r.role])).toEqual([
      [
        '00000000-0000-4000-8000-000000000001',
        'somchai@student.chula.ac.th',
        'student',
      ],
      [
        '00000000-0000-4000-8000-000000000002',
        'malee@student.chula.ac.th',
        'student',
      ],
      [
        '00000000-0000-4000-8000-000000000003',
        'admin@campuskit.local',
        'admin',
      ],
    ]);
    expect(seeded).toEqual(
      DEMO_ACCOUNTS.map(({ id, email, role }) => ({ id, email, role })),
    );
  });

  it('uses lowercase emails, which the accounts table requires', async () => {
    const { seed, upserted } = setup();
    await seed();
    for (const row of upserted()) {
      expect(row.email).toBe(row.email.trim().toLowerCase());
    }
  });

  it('makes both students eligible to publish and book', async () => {
    const { seed, upserted } = setup();
    await seed();
    const students = upserted().filter((r) => r.role === 'student');
    expect(students).toHaveLength(2);
    for (const student of students) {
      expect(checkEligibility(student)).toEqual({
        canPublish: true,
        canBook: true,
        reasons: [],
      });
    }
  });

  it('seeds one administrator without a payout profile', async () => {
    const { seed, upserted } = setup();
    await seed();
    const admin = byEmail(upserted(), 'admin@campuskit.local');
    expect(admin).toMatchObject({ role: 'admin', payoutProfile: null });
    expect(checkEligibility(admin).reasons).toContain('NOT_A_STUDENT');
  });

  it('stores the hash of the demo password, hashed once per run', async () => {
    const { hasher, seed, upserted } = setup();
    await seed();
    expect(hasher.hash).toHaveBeenCalledTimes(1);
    expect(hasher.hash).toHaveBeenCalledWith(DEMO_PASSWORD);
    for (const row of upserted()) {
      expect(row.passwordHash).toBe('scrypt$hash');
    }
    expect(JSON.stringify(upserted())).not.toContain(DEMO_PASSWORD);
  });

  it('resets an existing demo account, including a suspension and a student review', async () => {
    const { seed, upserted } = setup([
      {
        id: '00000000-0000-4000-8000-000000000001',
        email: 'somchai@student.chula.ac.th',
        suspendedAt: new Date(),
        studentStatus: 'REJECTED',
        studentRejectionReason: 'Not a current student',
      },
    ]);
    await seed();
    expect(byEmail(upserted(), 'somchai@student.chula.ac.th')).toMatchObject({
      suspendedAt: null,
      studentStatus: 'VERIFIED',
      studentRejectionReason: null,
      studentReviewedBy: null,
    });
  });

  it('writes the same rows when run twice', async () => {
    const { repo, seed, upserted } = setup();
    await seed();
    repo.findBy.mockResolvedValue(upserted());
    await seed();
    expect(upserted(1)).toEqual(upserted(0));
  });

  it('refuses a demo email that belongs to another account and writes nothing', async () => {
    const { repo, hasher, seed } = setup([
      { id: 'someone-else', email: 'malee@student.chula.ac.th' },
    ]);
    await expect(seed()).rejects.toThrow(DemoEmailTakenError);
    await expect(seed()).rejects.toThrow('malee@student.chula.ac.th');
    expect(repo.upsert).not.toHaveBeenCalled();
    expect(hasher.hash).not.toHaveBeenCalled();
  });
});
