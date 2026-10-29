import {
  createTestDatabase,
  type TestDatabase,
} from '../testing/test-database.js';

const accountId = '00000000-0000-4000-8000-000000000001';

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'CreateEmailVerifications migration',
  () => {
    let test: TestDatabase;

    beforeAll(async () => {
      test = await createTestDatabase();
    });

    afterAll(async () => {
      await test?.drop();
    });

    beforeEach(async () => {
      await test.db.query(
        `INSERT INTO accounts (id, email, password_hash, display_name)
         VALUES ($1, 'somchai@student.chula.ac.th', 'scrypt$hash', 'Somchai')`,
        [accountId],
      );
    });

    afterEach(async () => {
      await test.db.query(`DELETE FROM accounts`);
    });

    function insert(fields: Record<string, unknown> = {}): Promise<unknown> {
      const row = {
        account_id: accountId,
        code_hash: 'a'.repeat(64),
        expires_at: '2026-10-29T05:15:00Z',
        created_at: '2026-10-29T05:00:00Z',
        ...fields,
      };
      const columns = Object.keys(row);
      return test.db.query(
        `INSERT INTO email_verifications (${columns.join(', ')})
         VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')})`,
        Object.values(row),
      );
    }

    it('starts a code with no attempts', async () => {
      await insert();
      const [row] = (await test.db.query(
        `SELECT attempts FROM email_verifications`,
      )) as { attempts: number }[];
      expect(row.attempts).toBe(0);
    });

    it('keeps one code per account', async () => {
      await insert();
      await expect(insert()).rejects.toThrow(/email_verifications_pkey/);
    });

    it('refuses a code for an unknown account', async () => {
      await expect(
        insert({ account_id: '00000000-0000-4000-8000-000000000099' }),
      ).rejects.toThrow(/foreign key/);
    });

    it('removes the code with its account', async () => {
      await insert();
      await test.db.query(`DELETE FROM accounts`);
      const rows = (await test.db.query(
        `SELECT 1 FROM email_verifications`,
      )) as unknown[];
      expect(rows).toEqual([]);
    });

    it('refuses negative attempts and an expiry before issue', async () => {
      await expect(insert({ attempts: -1 })).rejects.toThrow(
        /email_verifications_attempts_check/,
      );
      await expect(
        insert({ expires_at: '2026-10-29T04:00:00Z' }),
      ).rejects.toThrow(/email_verifications_expiry_check/);
    });
  },
);
