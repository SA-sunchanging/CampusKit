import {
  findEvidence,
  insertEvidence,
  type NewEvidence,
} from '../evidence/evidence.row.js';
import {
  createTestDatabase,
  type TestDatabase,
} from '../testing/test-database.js';

const owner = '00000000-0000-4000-8000-000000000001';
const renter = '00000000-0000-4000-8000-000000000002';
const photo = 'data:image/jpeg;base64,AAAA';

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'CreateRentalEvidence migration',
  () => {
    let test: TestDatabase;
    let rentalId: string;

    beforeAll(async () => {
      test = await createTestDatabase();
      const [rental] = (await test.db.query(
        `INSERT INTO rentals (booking_id, listing_id, owner_id, renter_id,
           period_start, period_end, rental_fee, deposit, late_fee_per_day,
           pickup_code, return_code)
         VALUES (gen_random_uuid(), gen_random_uuid(), $1, $2,
           '2026-11-01T17:00:00Z', '2026-11-04T17:00:00Z', 6000, 30000, 4000,
           '012345', '987654')
         RETURNING id`,
        [owner, renter],
      )) as { id: string }[];
      rentalId = rental.id;
    });

    afterAll(async () => {
      await test?.drop();
    });

    afterEach(async () => {
      await test.db.query(`DELETE FROM rental_evidence`);
    });

    function evidence(overrides: Partial<NewEvidence> = {}): NewEvidence {
      return {
        rentalId,
        stage: 'PICKUP',
        recordedBy: renter,
        recorderRole: 'renter',
        condition: 'GOOD',
        accessories: ['Charger', 'Case'],
        photos: [photo],
        note: 'Small scratch on the lid.',
        ...overrides,
      };
    }

    it('stores a record with its lists and answers it', async () => {
      const saved = await insertEvidence(test.db, evidence());
      expect(saved).toMatchObject({
        rental_id: rentalId,
        stage: 'PICKUP',
        recorded_by: renter,
        recorder_role: 'renter',
        condition: 'GOOD',
        accessories: ['Charger', 'Case'],
        photos: [photo],
        note: 'Small scratch on the lid.',
      });
      expect(saved?.created_at).toBeInstanceOf(Date);
    });

    it('keeps one record per person and stage', async () => {
      await insertEvidence(test.db, evidence());
      await expect(
        insertEvidence(test.db, evidence({ condition: 'FAIR' })),
      ).resolves.toBeUndefined();
      await expect(
        insertEvidence(test.db, evidence({ stage: 'RETURN' })),
      ).resolves.toBeDefined();
      await expect(
        insertEvidence(
          test.db,
          evidence({ recordedBy: owner, recorderRole: 'owner' }),
        ),
      ).resolves.toBeDefined();
    });

    it('lists the pickup records before the return records', async () => {
      await insertEvidence(test.db, evidence({ stage: 'RETURN' }));
      await insertEvidence(test.db, evidence());
      const rows = await findEvidence(test.db, rentalId);
      expect(rows.map((row) => row.stage)).toEqual(['PICKUP', 'RETURN']);
    });

    it.each([
      ['rental_evidence_stage_check', { stage: 'HANDOVER' }],
      ['rental_evidence_role_check', { recorderRole: 'admin' }],
      ['rental_evidence_condition_check', { condition: 'BROKEN' }],
      [
        'rental_evidence_accessories_check',
        { accessories: Array.from({ length: 21 }, () => 'cable') },
      ],
      [
        'rental_evidence_photos_check',
        { photos: Array.from({ length: 4 }, () => photo) },
      ],
      ['rental_evidence_note_check', { note: 'n'.repeat(501) }],
      [
        'rental_evidence_rental_id_fkey',
        { rentalId: '44444444-4444-4444-8444-444444444444' },
      ],
    ])('enforces %s', async (constraint, fields) => {
      await expect(
        insertEvidence(test.db, evidence(fields as Partial<NewEvidence>)),
      ).rejects.toThrow(constraint);
    });
  },
);
