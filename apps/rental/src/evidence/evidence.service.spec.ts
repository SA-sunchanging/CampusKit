import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { DataSource } from 'typeorm';
import type { RentalStatus } from '../rentals/rental.entity.js';
import type { RentalRow } from '../rentals/rental.row.js';
import {
  errorOf,
  OWNER_ID,
  RENTAL_ID,
  RENTER_ID,
  rentalRow,
  STRANGER_ID,
} from '../testing/fixtures.js';
import { MAX_PHOTO_BYTES } from './evidence-options.js';
import type { EvidenceRow } from './evidence.row.js';
import { EvidenceService, stageProblem } from './evidence.service.js';
import type { RecordEvidenceDto } from './record-evidence.dto.js';

const renter = { sub: RENTER_ID, role: 'student' as const };
const owner = { sub: OWNER_ID, role: 'student' as const };
const stranger = { sub: STRANGER_ID, role: 'student' as const };
const photo = 'data:image/jpeg;base64,AAAA';
const CREATED_AT = new Date('2026-11-01T10:00:00Z');

function dto(overrides: Partial<RecordEvidenceDto> = {}): RecordEvidenceDto {
  return {
    stage: 'PICKUP',
    condition: 'GOOD',
    accessories: ['Charger'],
    photos: [photo],
    note: 'Small scratch on the lid.',
    ...overrides,
  };
}

/**
 * A rental_db with one rental and its evidence. It answers the rental SELECT, the evidence
 * INSERT ... ON CONFLICT DO NOTHING (keyed like the unique constraint) and the evidence SELECT.
 */
function setup(row: RentalRow | null = rentalRow()) {
  const stored: EvidenceRow[] = [];
  const query = vi.fn((sql: string, params: unknown[]) => {
    const text = sql.trim();
    if (text.startsWith('SELECT') && text.includes('FROM rentals')) {
      return Promise.resolve(row && row.id === params[0] ? [{ ...row }] : []);
    }
    if (text.startsWith('INSERT INTO rental_evidence')) {
      const [rentalId, stage, recordedBy, role, condition, accessories] =
        params as [string, string, string, string, string, string[]];
      const taken = stored.some(
        (e) =>
          e.rental_id === rentalId &&
          e.stage === stage &&
          e.recorded_by === recordedBy,
      );
      if (taken) return Promise.resolve([]);
      const saved = {
        id: `evidence-${stored.length + 1}`,
        rental_id: rentalId,
        stage,
        recorded_by: recordedBy,
        recorder_role: role,
        condition,
        accessories,
        photos: params[6] as string[],
        note: params[7] as string | null,
        created_at: CREATED_AT,
      } as EvidenceRow;
      stored.push(saved);
      return Promise.resolve([saved]);
    }
    if (text.startsWith('SELECT') && text.includes('FROM rental_evidence')) {
      return Promise.resolve(stored.filter((e) => e.rental_id === params[0]));
    }
    return Promise.reject(new Error(`Unexpected SQL: ${sql}`));
  });
  const transaction = (work: (tx: { query: typeof query }) => unknown) =>
    work({ query });
  const service = new EvidenceService({
    query,
    transaction,
  } as unknown as DataSource);
  return { service, query, stored };
}

describe('stageProblem', () => {
  it.each([
    ['PICKUP', 'AWAITING_PICKUP'],
    ['RETURN', 'ACTIVE'],
  ] as const)('opens %s while %s', (stage, status) => {
    expect(stageProblem(stage, status)).toBeUndefined();
  });

  it.each([
    ['PICKUP', 'ACTIVE'],
    ['PICKUP', 'SETTLEMENT_PENDING'],
    ['PICKUP', 'CLOSED'],
    ['PICKUP', 'CANCELLED'],
    ['RETURN', 'AWAITING_PICKUP'],
    ['RETURN', 'SETTLEMENT_PENDING'],
    ['RETURN', 'CLOSED'],
    ['RETURN', 'CANCELLED'],
  ] as const)('closes %s while %s', (stage, status) => {
    expect(stageProblem(stage, status)).toMatch(/can be recorded only while/);
  });
});

describe('EvidenceService', () => {
  describe('record', () => {
    it.each([
      ['renter', renter],
      ['owner', owner],
    ] as const)(
      'records the pickup evidence of the %s',
      async (role, caller) => {
        const { service, query } = setup();
        const evidence = await service.record(caller, RENTAL_ID, dto());
        expect(evidence).toEqual({
          id: 'evidence-1',
          rentalId: RENTAL_ID,
          stage: 'PICKUP',
          recordedBy: caller.sub,
          recorderRole: role,
          condition: 'GOOD',
          accessories: ['Charger'],
          photos: [photo],
          note: 'Small scratch on the lid.',
          createdAt: CREATED_AT.toISOString(),
        });
        expect(query.mock.calls[0][0]).toContain('FOR UPDATE');
      },
    );

    it('records the return evidence of an overdue ACTIVE rental', async () => {
      const { service } = setup(
        rentalRow({ status: 'ACTIVE', overdue_at: CREATED_AT }),
      );
      const evidence = await service.record(
        owner,
        RENTAL_ID,
        dto({ stage: 'RETURN' }),
      );
      expect(evidence.stage).toBe('RETURN');
    });

    it('stores no note as null and answers it as empty', async () => {
      const { service, stored } = setup();
      const evidence = await service.record(
        renter,
        RENTAL_ID,
        dto({ note: undefined }),
      );
      expect(stored[0].note).toBeNull();
      expect(evidence.note).toBe('');
    });

    it.each<[string, RentalStatus, 'PICKUP' | 'RETURN']>([
      ['pickup after the pickup', 'ACTIVE', 'PICKUP'],
      ['return before the pickup', 'AWAITING_PICKUP', 'RETURN'],
      ['return after the return', 'CLOSED', 'RETURN'],
      ['pickup of a cancelled rental', 'CANCELLED', 'PICKUP'],
    ])('answers 409 to %s', async (_label, status, stage) => {
      const { service, stored } = setup(rentalRow({ status }));
      const err = await errorOf(
        service.record(renter, RENTAL_ID, dto({ stage })),
      );
      expect(err).toBeInstanceOf(ConflictException);
      expect(stored).toEqual([]);
    });

    it('answers 409 to a second record of the same stage', async () => {
      const { service, stored } = setup();
      await service.record(renter, RENTAL_ID, dto());
      const err = await errorOf(service.record(renter, RENTAL_ID, dto()));
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as Error).message).toBe(
        'You already recorded the pickup evidence',
      );
      expect(stored).toHaveLength(1);
    });

    it('lets each party record each stage once', async () => {
      const { service, stored } = setup();
      await service.record(renter, RENTAL_ID, dto());
      await service.record(owner, RENTAL_ID, dto());
      expect(stored.map((e) => e.recorder_role)).toEqual(['renter', 'owner']);
    });

    it('answers 404 to someone who does not take part', async () => {
      const { service, stored } = setup();
      const err = await errorOf(service.record(stranger, RENTAL_ID, dto()));
      expect(err).toBeInstanceOf(NotFoundException);
      expect(stored).toEqual([]);
    });

    it('answers 404 for an unknown rental', async () => {
      const { service } = setup(null);
      await expect(
        service.record(renter, RENTAL_ID, dto()),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('answers 400 to a photo over the size limit before reading', async () => {
      const { service, query } = setup();
      const big = `data:image/jpeg;base64,${Buffer.alloc(MAX_PHOTO_BYTES + 1).toString('base64')}`;
      const err = await errorOf(
        service.record(renter, RENTAL_ID, dto({ photos: [photo, big] })),
      );
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as Error).message).toBe('Photo 2 is larger than 400 KB');
      expect(query).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('shows both parties every record of the rental', async () => {
      const { service } = setup();
      await service.record(renter, RENTAL_ID, dto());
      await service.record(owner, RENTAL_ID, dto({ condition: 'FAIR' }));
      for (const caller of [renter, owner]) {
        const list = await service.list(caller, RENTAL_ID);
        expect(list.evidence.map((e) => [e.recorderRole, e.condition])).toEqual(
          [
            ['renter', 'GOOD'],
            ['owner', 'FAIR'],
          ],
        );
      }
    });

    it('answers 404 to someone who does not take part', async () => {
      const { service } = setup();
      await expect(service.list(stranger, RENTAL_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
