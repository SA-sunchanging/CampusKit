import { BadRequestException } from '@nestjs/common';
import {
  checkPhotoSizes,
  dataUrlBytes,
  IMAGE_DATA_URL,
  MAX_PHOTO_BYTES,
} from './evidence-options.js';

function imageOf(bytes: number): string {
  return `data:image/jpeg;base64,${Buffer.alloc(bytes).toString('base64')}`;
}

describe('dataUrlBytes', () => {
  it.each([1, 2, 3, 1000])('decodes the size of %i bytes', (bytes) => {
    expect(dataUrlBytes(imageOf(bytes))).toBe(bytes);
  });
});

describe('IMAGE_DATA_URL', () => {
  it('accepts JPEG, PNG, and WebP data URLs', () => {
    expect(IMAGE_DATA_URL.test(imageOf(3))).toBe(true);
    expect(IMAGE_DATA_URL.test('data:image/png;base64,AAAA')).toBe(true);
    expect(IMAGE_DATA_URL.test('data:image/webp;base64,AAAA')).toBe(true);
  });

  it('rejects other types and plain URLs', () => {
    expect(IMAGE_DATA_URL.test('data:image/svg+xml;base64,AAAA')).toBe(false);
    expect(IMAGE_DATA_URL.test('https://example.com/a.jpg')).toBe(false);
  });
});

describe('checkPhotoSizes', () => {
  it('accepts no photos and photos at the limit', () => {
    expect(() => checkPhotoSizes([])).not.toThrow();
    expect(() => checkPhotoSizes([imageOf(MAX_PHOTO_BYTES)])).not.toThrow();
  });

  it('rejects a photo over the limit, naming it', () => {
    expect(() =>
      checkPhotoSizes([imageOf(10), imageOf(MAX_PHOTO_BYTES + 1)]),
    ).toThrow(new BadRequestException('Photo 2 is larger than 400 KB'));
  });
});
