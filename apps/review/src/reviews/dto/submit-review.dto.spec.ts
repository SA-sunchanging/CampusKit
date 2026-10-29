import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { MAX_COMMENT_LENGTH, SubmitReviewDto } from './submit-review.dto.js';

const RENTAL_ID = '11111111-1111-4111-8111-111111111111';

function parse(body: Record<string, unknown>) {
  const dto = plainToInstance(SubmitReviewDto, {
    rentalId: RENTAL_ID,
    ...body,
  });
  return { dto, errors: validateSync(dto).map((error) => error.property) };
}

describe('SubmitReviewDto', () => {
  it.each([1, 5])('accepts a rating of %i', (rating) => {
    expect(parse({ rating }).errors).toEqual([]);
  });

  it.each([0, 6, 3.5, '4'])('rejects a rating of %s', (rating) => {
    expect(parse({ rating }).errors).toContain('rating');
  });

  it('rejects a rental ID that is not a UUID', () => {
    expect(parse({ rentalId: 'r1', rating: 4 }).errors).toContain('rentalId');
  });

  it('trims the comment and drops a blank one', () => {
    expect(parse({ rating: 4, comment: '  Great  ' }).dto.comment).toBe(
      'Great',
    );
    const blank = parse({ rating: 4, comment: '   ' });
    expect(blank.errors).toEqual([]);
    expect(blank.dto.comment).toBeUndefined();
  });

  it('accepts a comment of the maximum length after trimming', () => {
    const comment = ` ${'x'.repeat(MAX_COMMENT_LENGTH)} `;
    expect(parse({ rating: 4, comment }).errors).toEqual([]);
  });

  it('rejects a longer comment', () => {
    const comment = 'x'.repeat(MAX_COMMENT_LENGTH + 1);
    expect(parse({ rating: 4, comment }).errors).toContain('comment');
  });
});
