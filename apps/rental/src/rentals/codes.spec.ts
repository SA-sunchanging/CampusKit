import { CODE_PATTERN, codesMatch, generateCode } from './codes.js';

describe('generateCode', () => {
  it('draws from [0, 1000000) and pads to six digits', () => {
    const draw = vi.fn(() => 42);
    expect(generateCode(draw)).toBe('000042');
    expect(draw).toHaveBeenCalledWith(0, 1_000_000);
    expect(generateCode(() => 0)).toBe('000000');
    expect(generateCode(() => 999_999)).toBe('999999');
  });

  it('makes six-digit codes from crypto.randomInt by default', () => {
    const codes = Array.from({ length: 200 }, () => generateCode());
    for (const code of codes) {
      expect(code).toMatch(CODE_PATTERN);
    }
    expect(new Set(codes).size).toBeGreaterThan(1);
  });
});

describe('codesMatch', () => {
  it('matches the same six digits', () => {
    expect(codesMatch('012345', '012345')).toBe(true);
  });

  it.each([
    ['another code', '012346'],
    ['a shorter code', '12345'],
    ['a longer code', '0123456'],
    ['a code with letters', '01234a'],
    ['a code with spaces', ' 12345'],
    ['an empty code', ''],
    ['a number', 12345],
    ['undefined', undefined],
  ])('does not match %s', (_label, given) => {
    expect(codesMatch('012345', given)).toBe(false);
  });

  it('never matches a stored value that is not six digits', () => {
    expect(codesMatch('12345', '12345')).toBe(false);
    expect(codesMatch('', '')).toBe(false);
  });
});
