import { useRef, useState, type ChangeEvent } from 'react';
import { Button, Field } from '../../ui/index.ts';
import { FieldError } from './FormParts.tsx';
import type { PhotoItem } from './listingForm.ts';
import {
  compressImage,
  MAX_PHOTOS,
  PHOTO_MAX_BYTES,
  PHOTO_MAX_WIDTH,
  THUMBNAIL_MAX_BYTES,
  THUMBNAIL_MAX_WIDTH,
} from './photos.ts';

type PhotoUpdate = (update: (photos: PhotoItem[]) => PhotoItem[]) => void;

async function prepare(file: File, key: number): Promise<PhotoItem> {
  const dataUrl = await compressImage(file, PHOTO_MAX_WIDTH, PHOTO_MAX_BYTES);
  const thumbnail = await compressImage(
    file,
    THUMBNAIL_MAX_WIDTH,
    THUMBNAIL_MAX_BYTES,
  );
  return { key, dataUrl, thumbnail };
}

// Photo input with previews. Photos are compressed in the browser before upload;
// the first photo is the cover and its thumbnail shows in search.
export default function PhotoPicker({
  photos,
  onChange,
  busy,
  onBusyChange,
  error,
}: {
  photos: PhotoItem[];
  onChange: PhotoUpdate;
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
  error?: string;
}) {
  const nextKey = useRef(1);
  const [problems, setProblems] = useState<string[]>([]);

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    const room = Math.max(MAX_PHOTOS - photos.length, 0);
    const found: string[] = [];
    if (files.length > room) {
      found.push(
        `Only ${MAX_PHOTOS} photos are allowed, so ${files.length - room} were skipped.`,
      );
    }
    onBusyChange(true);
    for (const file of files.slice(0, room)) {
      const key = nextKey.current;
      nextKey.current += 1;
      try {
        const photo = await prepare(file, key);
        onChange((list) =>
          list.length < MAX_PHOTOS ? [...list, photo] : list,
        );
      } catch (err) {
        found.push(`${file.name}: ${(err as Error).message}`);
      }
    }
    onBusyChange(false);
    setProblems(found);
  }

  function makeCover(key: number) {
    onChange((list) => [
      ...list.filter((photo) => photo.key === key),
      ...list.filter((photo) => photo.key !== key),
    ]);
  }

  return (
    <div className="stack">
      <div>
        <Field
          label="Photos"
          hint={`1 to ${MAX_PHOTOS}; the first is the cover`}
        >
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={busy || photos.length >= MAX_PHOTOS}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'photos-error' : undefined}
            onChange={(event) => void handleFiles(event)}
          />
        </Field>
        <FieldError name="photos" error={error} />
      </div>
      <p aria-live="polite">
        {busy
          ? 'Preparing photos...'
          : `${photos.length} of ${MAX_PHOTOS} photos added.`}
      </p>
      {problems.map((problem) => (
        <p key={problem} className="listing-error">
          {problem}
        </p>
      ))}
      {photos.length > 0 && (
        <ul className="listing-previews">
          {photos.map((photo, index) => (
            <li key={photo.key} className="listing-preview">
              <img src={photo.thumbnail} alt="" />
              <span>
                Photo {index + 1}
                {index === 0 && ' (cover)'}
              </span>
              <div className="actions">
                {index > 0 && (
                  <Button
                    variant="ghost"
                    size="small"
                    aria-label={`Make photo ${index + 1} the cover`}
                    onClick={() => makeCover(photo.key)}
                  >
                    Make cover
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="small"
                  aria-label={`Remove photo ${index + 1}`}
                  onClick={() =>
                    onChange((list) =>
                      list.filter((item) => item.key !== photo.key),
                    )
                  }
                >
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
