import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { RejectStudentDto } from './reject-student.dto.js';

function parse(body: Record<string, unknown>) {
  const dto = plainToInstance(RejectStudentDto, body);
  return { dto, errors: validateSync(dto).map((error) => error.property) };
}

describe('RejectStudentDto', () => {
  it('trims the reason', () => {
    const { dto, errors } = parse({ reason: '  Not enrolled  ' });
    expect(errors).toEqual([]);
    expect(dto.reason).toBe('Not enrolled');
  });

  it('accepts a reason of 300 characters', () => {
    expect(parse({ reason: 'x'.repeat(300) }).errors).toEqual([]);
  });

  it.each([['   '], ['x'.repeat(301)], [42], [undefined]])(
    'rejects the reason %j',
    (reason) => {
      expect(parse({ reason }).errors).toContain('reason');
    },
  );
});
