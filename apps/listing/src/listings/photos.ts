import { BadRequestException } from '@nestjs/common';

/** A base64 data URL of a JPEG, PNG, or WebP image. */
export const IMAGE_DATA_URL =
  /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

/** The browser compresses photos; these limits stop an uncompressed upload. */
export const MAX_PHOTO_BYTES = 400 * 1024;
export const MAX_THUMBNAIL_BYTES = 60 * 1024;

/** Decoded size in bytes of a base64 data URL. */
export function dataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

/** Throws 400 when a photo or the thumbnail is larger than its limit. */
export function checkPhotoSizes(photos: string[], thumbnail: string): void {
  photos.forEach((photo, index) => {
    if (dataUrlBytes(photo) > MAX_PHOTO_BYTES) {
      throw new BadRequestException(
        `Photo ${index + 1} is larger than ${MAX_PHOTO_BYTES / 1024} KB`,
      );
    }
  });
  if (dataUrlBytes(thumbnail) > MAX_THUMBNAIL_BYTES) {
    throw new BadRequestException(
      `The thumbnail is larger than ${MAX_THUMBNAIL_BYTES / 1024} KB`,
    );
  }
}
