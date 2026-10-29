import {
  createTestDatabase,
  type TestDatabase,
} from '../testing/test-database.js';

const admin = '00000000-0000-4000-8000-000000000003';
const now = '2026-10-29T05:00:00Z';

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'ReviewStudentStatus migration',
  () => {
    let test: TestDatabase;

    beforeAll(async () => {
      test = await createTestDatabase();
    });

    afterAll(async () => {
      await test?.drop();
    });

    afterEach(async () => {
      await test.db.query(`DELETE FROM accounts`);
    });

    let count = 0;
    function insert(fields: Record<string, unknown> = {}): Promise<unknown> {
      count += 1;
      const row = {
        email: `student${count}@student.chula.ac.th`,
        password_hash: 'scrypt$hash',
        display_name: 'Student',
        ...fields,
      };
      const columns = Object.keys(row);
      return test.db.query(
        `INSERT INTO accounts (${columns.join(', ')})
         VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')})`,
        Object.values(row),
      );
    }

    it('leaves a new account without a student ID or review', async () => {
      await insert();
      const [row] = (await test.db.query(
        `SELECT student_id, student_reviewed_by, student_rejection_reason
         FROM accounts`,
      )) as Record<string, unknown>[];
      expect(row).toEqual({
        student_id: null,
        student_reviewed_by: null,
        student_rejection_reason: null,
      });
    });

    it('accepts a PENDING student with a 10-digit student ID', async () => {
      await insert({
        student_status: 'PENDING',
        student_id: '6630012321',
        student_submitted_at: now,
      });
    });

    it('requires a student ID and submission time on a PENDING student', async () => {
      await expect(
        insert({ student_status: 'PENDING', student_submitted_at: now }),
      ).rejects.toThrow(/accounts_student_pending_check/);
      await expect(
        insert({ student_status: 'PENDING', student_id: '6630012321' }),
      ).rejects.toThrow(/accounts_student_pending_check/);
    });

    it.each(['663001232', '66300123210', '66300l2321'])(
      'refuses the student ID %s',
      async (studentId) => {
        await expect(insert({ student_id: studentId })).rejects.toThrow(
          /accounts_student_id_check/,
        );
      },
    );

    it('requires a reason and a reviewer on a REJECTED student', async () => {
      await insert({
        student_status: 'REJECTED',
        student_id: '6630012321',
        student_rejection_reason: 'Not enrolled',
        student_reviewed_by: admin,
        student_reviewed_at: now,
      });
      await expect(
        insert({
          student_status: 'REJECTED',
          student_reviewed_by: admin,
          student_reviewed_at: now,
        }),
      ).rejects.toThrow(/accounts_student_rejected_check/);
      await expect(
        insert({ student_status: 'REJECTED', student_rejection_reason: 'No' }),
      ).rejects.toThrow(/accounts_student_rejected_check/);
    });

    it('refuses an empty rejection reason', async () => {
      await expect(
        insert({
          student_status: 'REJECTED',
          student_rejection_reason: '',
          student_reviewed_by: admin,
          student_reviewed_at: now,
        }),
      ).rejects.toThrow(/accounts_student_rejection_reason_check/);
    });

    it('sets the reviewer and review time together', async () => {
      await expect(
        insert({ student_status: 'VERIFIED', student_reviewed_by: admin }),
      ).rejects.toThrow(/accounts_student_reviewed_check/);
    });

    it('still accepts a seeded VERIFIED student without a review', async () => {
      await insert({ student_status: 'VERIFIED', email_verified_at: now });
    });
  },
);
