import type { EntityManager } from 'typeorm';
import type { Account } from '../accounts/account.entity.js';
import { announceVerified, identityEventData } from './identity-events.js';

const account = {
  id: 'u1',
  email: 'somchai@student.chula.ac.th',
  studentId: '6630012321',
  studentStatus: 'VERIFIED',
} as Account;

describe('identityEventData', () => {
  it('carries the user ID and the new student status only', () => {
    expect(identityEventData(account)).toEqual({
      userId: 'u1',
      studentStatus: 'VERIFIED',
    });
  });
});

describe('announceVerified', () => {
  it('writes identity.verified for the student, produced by identity', async () => {
    const query = vi.fn().mockResolvedValue([]);
    await announceVerified(
      { query } as unknown as EntityManager,
      account,
      'corr-1',
    );
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('INSERT INTO outbox_events');
    expect(params[1]).toBe('identity.verified');
    expect(JSON.parse(params[2] as string)).toMatchObject({
      type: 'identity.verified',
      producer: 'identity',
      recipients: ['u1'],
      correlationId: 'corr-1',
      data: { userId: 'u1', studentStatus: 'VERIFIED' },
    });
  });
});
