import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { SubmitStudentStatusDto } from './submit-student-status.dto.js';

function parse(body: Record<string, unknown>) {
  const dto = plainToInstance(SubmitStudentStatusDto, body);
  return { dto, errors: validateSync(dto).map((error) => error.property) };
}

describe('SubmitStudentStatusDto', () => {
  it('accepts a 10-digit student ID, trimmed', () => {
    const { dto, errors } = parse({ studentId: ' 6630012321 ' });
    expect(errors).toEqual([]);
    expect(dto.studentId).toBe('6630012321');
  });

  it.each([
    ['663001232'],
    ['66300123210'],
    ['66300l2321'],
    [6630012321],
    [undefined],
  ])('rejects the student ID %j', (studentId) => {
    expect(parse({ studentId }).errors).toEqual(['studentId']);
  });
});
