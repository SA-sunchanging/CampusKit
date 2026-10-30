import { describe, expect, it } from 'vitest';
import type { Evidence } from '../../../api/rental.ts';
import {
  accessoriesProblem,
  canRecord,
  parseAccessories,
  recorderLabel,
  showStage,
  stageOpen,
  stageRecords,
} from './evidenceView.ts';

const OWNER = '11111111-1111-4111-8111-111111111111';
const RENTER = '22222222-2222-4222-8222-222222222222';

function record(overrides: Partial<Evidence> = {}): Evidence {
  return {
    id: 'e1',
    rentalId: 'r1',
    stage: 'PICKUP',
    recordedBy: OWNER,
    recorderRole: 'owner',
    condition: 'GOOD',
    accessories: [],
    photos: [],
    note: '',
    createdAt: '2026-11-01T10:00:00.000Z',
    ...overrides,
  };
}

const byRenter = record({
  id: 'e2',
  recordedBy: RENTER,
  recorderRole: 'renter',
});

describe('stageOpen', () => {
  it('opens pickup before the pickup and return while active', () => {
    expect(stageOpen('PICKUP', 'AWAITING_PICKUP')).toBe(true);
    expect(stageOpen('PICKUP', 'ACTIVE')).toBe(false);
    expect(stageOpen('RETURN', 'ACTIVE')).toBe(true);
    expect(stageOpen('RETURN', 'AWAITING_PICKUP')).toBe(false);
    expect(stageOpen('RETURN', 'CLOSED')).toBe(false);
  });
});

describe('stageRecords', () => {
  it('keeps the stage and puts the viewer first', () => {
    const records = [record(), byRenter, record({ id: 'e3', stage: 'RETURN' })];
    expect(stageRecords(records, 'PICKUP', RENTER).map((r) => r.id)).toEqual([
      'e2',
      'e1',
    ]);
  });
});

describe('canRecord', () => {
  it('lets each party record an open stage once', () => {
    const records = [record()];
    expect(canRecord('PICKUP', 'AWAITING_PICKUP', records, OWNER)).toBe(false);
    expect(
      canRecord('PICKUP', 'AWAITING_PICKUP', records, RENTER.toUpperCase()),
    ).toBe(true);
    expect(canRecord('PICKUP', 'ACTIVE', [], RENTER)).toBe(false);
  });
});

describe('showStage', () => {
  it('shows an open stage, and a closed one only with records', () => {
    expect(showStage('RETURN', 'ACTIVE', [])).toBe(true);
    expect(showStage('PICKUP', 'ACTIVE', [])).toBe(false);
    expect(showStage('PICKUP', 'ACTIVE', [record()])).toBe(true);
  });
});

describe('recorderLabel', () => {
  it('names the viewer and the other party', () => {
    expect(recorderLabel(record(), OWNER)).toBe('You');
    expect(recorderLabel(record(), RENTER)).toBe('The owner');
    expect(recorderLabel(byRenter, OWNER)).toBe('The renter');
  });
});

describe('parseAccessories', () => {
  it('takes one accessory per line without blanks', () => {
    expect(parseAccessories(' Charger \n\n  \nCase')).toEqual([
      'Charger',
      'Case',
    ]);
  });
});

describe('accessoriesProblem', () => {
  it('accepts up to 20 accessories of up to 60 characters', () => {
    expect(
      accessoriesProblem(Array.from({ length: 20 }, () => 'x'.repeat(60))),
    ).toBeNull();
  });

  it('refuses too many or too long accessories', () => {
    expect(accessoriesProblem(Array.from({ length: 21 }, () => 'x'))).toMatch(
      /at most 20/,
    );
    expect(accessoriesProblem(['x'.repeat(61)])).toMatch(/60 characters/);
  });
});
