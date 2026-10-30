import { describe, expect, it } from 'vitest';
import { evidenceBody, rentalsQuery, returnBody } from './rental.ts';

describe('rentalsQuery', () => {
  it('sends the role', () => {
    expect(rentalsQuery('renter')).toBe('?role=renter');
    expect(rentalsQuery('owner')).toBe('?role=owner');
  });
});

describe('returnBody', () => {
  it('sends the code when given', () => {
    expect(returnBody('012345')).toEqual({ code: '012345' });
  });

  it('sends no code for a settlement retry', () => {
    expect(returnBody()).toEqual({});
    expect(returnBody('')).toEqual({});
  });
});

describe('evidenceBody', () => {
  const input = {
    stage: 'PICKUP' as const,
    condition: 'GOOD' as const,
    accessories: [' Charger ', '', '  ', 'Case'],
    photos: ['data:image/jpeg;base64,AAAA'],
  };

  it('trims the accessories and drops blank ones', () => {
    expect(evidenceBody(input)).toEqual({
      stage: 'PICKUP',
      condition: 'GOOD',
      accessories: ['Charger', 'Case'],
      photos: ['data:image/jpeg;base64,AAAA'],
    });
  });

  it('sends the note only when written', () => {
    expect(evidenceBody({ ...input, note: '  Scratch on the lid ' }).note).toBe(
      'Scratch on the lid',
    );
    expect(evidenceBody({ ...input, note: '   ' })).not.toHaveProperty('note');
  });
});
