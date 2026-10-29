import { type DataSource, In } from 'typeorm';
import { Account } from '../accounts/account.entity.js';
import type { PasswordHasher } from '../passwords/password-hasher.js';
import {
  DEMO_ACCOUNTS,
  DEMO_PASSWORD,
  DEMO_VERIFIED_AT,
  type DemoAccount,
} from './demo-accounts.js';

/** A demo email belongs to an account with another ID, so the fixed ID cannot be kept. */
export class DemoEmailTakenError extends Error {
  constructor(email: string) {
    super(
      `${email} already belongs to another account; delete it (or run docker compose down -v) and seed again`,
    );
    this.name = 'DemoEmailTakenError';
  }
}

export type SeededAccount = Pick<Account, 'id' | 'email' | 'role'>;

/**
 * Creates the demo accounts, or resets them to their demo state if they exist, in one transaction.
 * Running it again gives the same rows, apart from a freshly salted password hash.
 */
export async function seedDemoAccounts(
  dataSource: Pick<DataSource, 'transaction'>,
  hasher: PasswordHasher,
  accounts: readonly DemoAccount[] = DEMO_ACCOUNTS,
): Promise<SeededAccount[]> {
  return dataSource.transaction(async (manager) => {
    const repo = manager.getRepository(Account);
    const existing = await repo.findBy({
      email: In(accounts.map((account) => account.email)),
    });
    for (const found of existing) {
      const demo = accounts.find((account) => account.email === found.email);
      if (demo && demo.id !== found.id) {
        throw new DemoEmailTakenError(found.email);
      }
    }
    const passwordHash = await hasher.hash(DEMO_PASSWORD);
    await repo.upsert(
      accounts.map((account) => ({
        ...account,
        passwordHash,
        emailVerifiedAt: DEMO_VERIFIED_AT,
        suspendedAt: null,
        studentId: null,
        studentSubmittedAt: null,
        studentReviewedBy: null,
        studentReviewedAt: null,
        studentRejectionReason: null,
      })),
      ['id'],
    );
    return accounts.map(({ id, email, role }) => ({ id, email, role }));
  });
}
