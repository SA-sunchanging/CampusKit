import { type ChangeEvent, useState } from 'react';
import { MAX_EVIDENCE_PHOTOS } from '../../../api/rental.ts';
import { Button, Field } from '../../../ui/index.ts';
import {
  compressImage,
  PHOTO_MAX_BYTES,
  PHOTO_MAX_WIDTH,
} from '../../listing/photos.ts';

// Up to three evidence photos, compressed in the browser like listing photos (role D).
export default function EvidencePhotos({
  photos,
  onChange,
  busy,
  onBusyChange,
}: {
  photos: string[];
  onChange: (update: (photos: string[]) => string[]) => void;
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const [problems, setProblems] = useState<string[]>([]);

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    const room = Math.max(MAX_EVIDENCE_PHOTOS - photos.length, 0);
    const found: string[] = [];
    if (files.length > room) {
      found.push(
        `Only ${MAX_EVIDENCE_PHOTOS} photos are allowed, so ${files.length - room} were skipped.`,
      );
    }
    onBusyChange(true);
    for (const file of files.slice(0, room)) {
      try {
        const photo = await compressImage(
          file,
          PHOTO_MAX_WIDTH,
          PHOTO_MAX_BYTES,
        );
        onChange((list) =>
          list.length < MAX_EVIDENCE_PHOTOS ? [...list, photo] : list,
        );
      } catch (err) {
        found.push(`${file.name}: ${(err as Error).message}`);
      }
    }
    onBusyChange(false);
    setProblems(found);
  }

  return (
    <div className="stack">
      <Field label="Photos" hint={`up to ${MAX_EVIDENCE_PHOTOS}`}>
        <input
          type="file"
          accept="image/*"
          multiple
          disabled={busy || photos.length >= MAX_EVIDENCE_PHOTOS}
          onChange={(event) => void handleFiles(event)}
        />
      </Field>
      {busy && <p aria-live="polite">Preparing photos...</p>}
      {problems.map((problem) => (
        <p key={problem} className="evidence-error">
          {problem}
        </p>
      ))}
      {photos.length > 0 && (
        <ul className="evidence-photos">
          {photos.map((photo, index) => (
            <li key={index}>
              <img src={photo} alt={`Photo ${index + 1}`} />
              <Button
                variant="ghost"
                size="small"
                aria-label={`Remove photo ${index + 1}`}
                onClick={() =>
                  onChange((list) => list.filter((_, at) => at !== index))
                }
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
