import { moderationFlags, REVIEW_VALUE } from './moderation-rules.js';

const plain = {
  title: 'Calculus I textbook',
  description: 'Clean copy with a few pencil notes.',
  replacementValue: 120000,
};

describe('moderationFlags', () => {
  it('lets an ordinary listing through', () => {
    expect(moderationFlags(plain)).toEqual([]);
  });

  it('flags a replacement value of exactly 10,000 THB', () => {
    expect(
      moderationFlags({ ...plain, replacementValue: REVIEW_VALUE }),
    ).toEqual(['Replacement value is 10,000 THB or more']);
  });

  it('lets a value one satang below the threshold through', () => {
    expect(
      moderationFlags({ ...plain, replacementValue: REVIEW_VALUE - 1 }),
    ).toEqual([]);
  });

  it('flags a keyword in the title regardless of case', () => {
    expect(moderationFlags({ ...plain, title: 'Airsoft GUN' })).toEqual([
      'Mentions "gun"',
    ]);
  });

  it('flags a keyword in the description next to punctuation', () => {
    expect(
      moderationFlags({
        ...plain,
        description: 'Comes with alcohol, unopened.',
      }),
    ).toEqual(['Mentions "alcohol"']);
  });

  it('matches English keywords as whole words only', () => {
    expect(
      moderationFlags({
        ...plain,
        title: 'Shotgun microphone',
        description: 'Work has begun; drugstore receipt included.',
      }),
    ).toEqual([]);
  });

  it('flags a Thai keyword inside unspaced Thai text', () => {
    expect(
      moderationFlags({
        ...plain,
        description: 'ให้เช่าปืนฉีดน้ำสำหรับงานสงกรานต์',
      }),
    ).toEqual(['Mentions "ปืน"']);
  });

  it('lists every reason once, value first', () => {
    expect(
      moderationFlags({
        title: 'Counterfeit watch',
        description: 'A replica, sold as counterfeit. ของปลอม',
        replacementValue: REVIEW_VALUE + 1,
      }),
    ).toEqual([
      'Replacement value is 10,000 THB or more',
      'Mentions "counterfeit"',
      'Mentions "replica"',
      'Mentions "ของปลอม"',
    ]);
  });
});
