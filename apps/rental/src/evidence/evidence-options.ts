import { BadRequestException } from '@nestjs/common';

/**
 * The listing condition codes. Services do not share code, so these are copied from Listing's
 * listing-options.ts; keep both lists (and the rental_evidence check) the same.
 */
export const CONDITIONS = ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR'] as const;
export type Condition = (typeof CONDITIONS)[number];

/** PICKUP is recorded while the rental awaits pickup; RETURN while it is ACTIVE. */
export const EVIDENCE_STAGES = ['PICKUP', 'RETURN'] as const;
export type EvidenceStage = (typeof EVIDENCE_STAGES)[number];

export const MAX_EVIDENCE_PHOTOS = 3;
export const MAX_ACCESSORIES = 20;
export const MAX_ACCESSORY_LENGTH = 60;
export const MAX_NOTE_LENGTH = 500;

/** A base64 data URL of a JPEG, PNG, or WebP image, as Listing accepts it. */
export const IMAGE_DATA_URL =
  /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

/** The browser compresses photos; Listing's photo limit stops an uncompressed upload. */
export const MAX_PHOTO_BYTES = 400 * 1024;

/** Decoded size in bytes of a base64 data URL. */
export function dataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

/** Throws 400 naming the first photo larger than MAX_PHOTO_BYTES. */
export function checkPhotoSizes(photos: string[]): void {
  photos.forEach((photo, index) => {
    if (dataUrlBytes(photo) > MAX_PHOTO_BYTES) {
      throw new BadRequestException(
        `Photo ${index + 1} is larger than ${MAX_PHOTO_BYTES / 1024} KB`,
      );
    }
  });
}
