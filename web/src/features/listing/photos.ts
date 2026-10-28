// Photo helpers for the create form. The browser compresses every photo so the
// upload stays within the listing service's limits.
export const MAX_PHOTOS = 5;
export const PHOTO_MAX_WIDTH = 1280;
export const PHOTO_MAX_BYTES = 400 * 1024;
export const THUMBNAIL_MAX_WIDTH = 400;
export const THUMBNAIL_MAX_BYTES = 60 * 1024;

const START_QUALITY = 0.8;
const MIN_QUALITY = 0.4;
const QUALITY_STEP = 0.1;
/** When the lowest quality is still too large, shrink the picture this much and retry. */
const SHRINK = 0.75;
const MAX_SHRINKS = 4;

export interface Size {
  width: number;
  height: number;
}

/** Scales a picture down to maxWidth, keeping its aspect ratio. Never upscales. */
export function fitWithin(
  width: number,
  height: number,
  maxWidth: number,
): Size {
  if (width <= maxWidth) return { width, height };
  return {
    width: maxWidth,
    height: Math.max(1, Math.round((height * maxWidth) / width)),
  };
}

/** Decoded size in bytes of a base64 data URL (the size the server checks). */
export function dataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

/** The JPEG qualities to try, best first: 0.8, 0.7, ..., 0.4. */
export function qualitySteps(): number[] {
  const steps: number[] = [];
  for (let q = START_QUALITY; q >= MIN_QUALITY - 1e-9; q -= QUALITY_STEP) {
    steps.push(Math.round(q * 10) / 10);
  }
  return steps;
}

function encode(bitmap: ImageBitmap, size: Size, quality: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser cannot resize photos.');
  // JPEG has no transparency, so paint a white page under transparent PNGs.
  context.fillStyle = 'white';
  context.fillRect(0, 0, size.width, size.height);
  context.drawImage(bitmap, 0, 0, size.width, size.height);
  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Browser only. Resizes an image to maxWidth and encodes it as a JPEG data URL of
 * at most maxBytes, lowering the quality step by step, then the size if needed.
 */
export async function compressImage(
  file: Blob,
  maxWidth: number,
  maxBytes: number,
): Promise<string> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('This file is not a photo the browser can read.');
  }
  try {
    let size = fitWithin(bitmap.width, bitmap.height, maxWidth);
    for (let shrink = 0; shrink <= MAX_SHRINKS; shrink += 1) {
      for (const quality of qualitySteps()) {
        const dataUrl = encode(bitmap, size, quality);
        if (dataUrlBytes(dataUrl) <= maxBytes) return dataUrl;
      }
      size = fitWithin(
        size.width,
        size.height,
        Math.round(size.width * SHRINK),
      );
    }
    throw new Error('This photo could not be made small enough.');
  } finally {
    bitmap.close();
  }
}
