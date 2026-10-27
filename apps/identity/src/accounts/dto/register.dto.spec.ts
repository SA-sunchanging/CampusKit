import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { RegisterDto } from './register.dto.js';

const valid = {
  email: 'somchai@student.chula.ac.th',
  password: 'correct horse',
  displayName: 'Somchai',
};

function errorsFor(body: Record<string, unknown>): string[] {
  return validateSync(plainToInstance(RegisterDto, body)).map(
    (error) => error.property,
  );
}

describe('RegisterDto', () => {
  it('accepts a valid registration', () => {
    expect(errorsFor(valid)).toEqual([]);
  });

  it('trims and lowercases the email before checking it', () => {
    const dto = plainToInstance(RegisterDto, {
      ...valid,
      email: '  Somchai@Student.Chula.ac.th ',
    });
    expect(dto.email).toBe('somchai@student.chula.ac.th');
    expect(validateSync(dto)).toEqual([]);
  });

  it.each(['', 'not-an-email', 'a@', 42])('rejects the email %j', (email) => {
    expect(errorsFor({ ...valid, email })).toEqual(['email']);
  });

  it.each([
    ['7 characters', 'a'.repeat(7)],
    ['73 characters', 'a'.repeat(73)],
    ['a number', 12345678],
  ])('rejects a password of %s', (_case, password) => {
    expect(errorsFor({ ...valid, password })).toEqual(['password']);
  });

  it.each([8, 72])('accepts a password of %i characters', (length) => {
    expect(errorsFor({ ...valid, password: 'a'.repeat(length) })).toEqual([]);
  });

  it('trims the display name', () => {
    const dto = plainToInstance(RegisterDto, {
      ...valid,
      displayName: '  Somchai  ',
    });
    expect(dto.displayName).toBe('Somchai');
  });

  it.each(['', '   ', 'a'.repeat(51)])(
    'rejects the display name %j',
    (displayName) => {
      expect(errorsFor({ ...valid, displayName })).toEqual(['displayName']);
    },
  );
});
