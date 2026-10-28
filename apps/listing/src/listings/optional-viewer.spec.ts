import { JwtService } from '@nestjs/jwt';
import { optionalViewer } from './optional-viewer.js';

const jwt = new JwtService({ secret: 'test-secret' });
const sub = '00000000-0000-4000-8000-000000000001';

describe('optionalViewer', () => {
  it('returns the caller of a valid token', () => {
    const token = jwt.sign({ sub, role: 'student' }, { expiresIn: 60 });
    expect(optionalViewer(`Bearer ${token}`, jwt)).toEqual({
      sub,
      role: 'student',
    });
  });

  it('treats a missing or forged token as a guest', () => {
    const forged = new JwtService({ secret: 'other' }).sign(
      { sub, role: 'student' },
      { expiresIn: 60 },
    );
    expect(optionalViewer(undefined, jwt)).toBeNull();
    expect(optionalViewer(`Bearer ${forged}`, jwt)).toBeNull();
  });
});
