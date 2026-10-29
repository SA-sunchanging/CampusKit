import { describe, expect, it } from 'vitest';
import { cleanCode, isCompleteCode } from './codeInput.ts';

describe('cleanCode', () => {
  it('keeps the digits only', () => {
    expect(cleanCode(' 482 913 ')).toBe('482913');
    expect(cleanCode('48-29a1')).toBe('48291');
    expect(cleanCode('')).toBe('');
  });

  it('keeps at most six digits', () => {
    expect(cleanCode('1234567')).toBe('123456');
  });
});

describe('isCompleteCode', () => {
  it('accepts exactly six digits', () => {
    expect(isCompleteCode('012345')).toBe(true);
  });

  it.each(['', '12345', '1234567', '12345a', '12 345'])(
    'rejects %j',
    (code) => {
      expect(isCompleteCode(code)).toBe(false);
    },
  );
});
