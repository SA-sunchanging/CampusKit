import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { RecordEvidenceDto } from './record-evidence.dto.js';

const photo = 'data:image/jpeg;base64,AAAA';

const valid = {
  stage: 'PICKUP',
  condition: 'GOOD',
  accessories: ['  Charger ', 'Case'],
  photos: [photo, photo, photo],
  note: '  Small scratch on the lid. ',
};

function errorsFor(fields: Record<string, unknown>): string[] {
  const dto = plainToInstance(RecordEvidenceDto, { ...valid, ...fields });
  return validateSync(dto).map((error) => error.property);
}

describe('RecordEvidenceDto', () => {
  it('accepts complete evidence and trims the text', () => {
    const dto = plainToInstance(RecordEvidenceDto, valid);
    expect(validateSync(dto)).toEqual([]);
    expect(dto.accessories).toEqual(['Charger', 'Case']);
    expect(dto.note).toBe('Small scratch on the lid.');
  });

  it('accepts evidence without accessories, photos, or a note', () => {
    expect(errorsFor({ accessories: [], photos: [], note: undefined })).toEqual(
      [],
    );
  });

  it('accepts the limits', () => {
    expect(
      errorsFor({
        accessories: Array.from({ length: 20 }, () => 'x'.repeat(60)),
        note: 'n'.repeat(500),
      }),
    ).toEqual([]);
  });

  it.each([
    ['stage', 'HANDOVER'],
    ['condition', 'BROKEN'],
    ['condition', undefined],
    ['accessories', undefined],
    ['accessories', Array.from({ length: 21 }, () => 'cable')],
    ['accessories', ['   ']],
    ['accessories', ['x'.repeat(61)]],
    ['accessories', [5]],
    ['photos', undefined],
    ['photos', Array.from({ length: 4 }, () => photo)],
    ['photos', ['https://example.com/a.jpg']],
    ['photos', ['data:image/svg+xml;base64,AAAA']],
    ['note', 'n'.repeat(501)],
    ['note', 5],
  ])('rejects an invalid %s', (field, value) => {
    expect(errorsFor({ [field]: value })).toContain(field);
  });
});
