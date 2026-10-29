import { authorizationRow, NOW } from '../testing/fake-ledger.js';
import { reportedStatus } from './authorization.row.js';

describe('reportedStatus', () => {
  it('reports an AUTHORIZED row as EXPIRED from its expiry time', () => {
    expect(reportedStatus(authorizationRow({ expires_at: NOW }), NOW)).toBe(
      'EXPIRED',
    );
    expect(
      reportedStatus(
        authorizationRow({ expires_at: new Date(NOW.getTime() + 1) }),
        NOW,
      ),
    ).toBe('AUTHORIZED');
  });

  it.each(['CAPTURED', 'SETTLED', 'VOIDED'] as const)(
    'keeps %s after the expiry time',
    (status) => {
      const row = authorizationRow({ status, expires_at: new Date(0) });
      expect(reportedStatus(row, NOW)).toBe(status);
    },
  );
});
