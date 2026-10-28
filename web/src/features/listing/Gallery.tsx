import { useState } from 'react';
import { BoxIcon } from '../../ui/index.ts';

// Cover photo with small thumbnails to switch between the listing's photos.
export default function Gallery({
  photos,
  title,
}: {
  photos: string[];
  title: string;
}) {
  const [shown, setShown] = useState(0);
  const index = Math.min(shown, Math.max(photos.length - 1, 0));
  const current = photos.at(index);
  return (
    <div className="listing-gallery">
      <div className="listing-cover">
        {current ? (
          <img
            src={current}
            alt={`${title}, photo ${index + 1} of ${photos.length}`}
          />
        ) : (
          <BoxIcon size={96} title="No photo" />
        )}
      </div>
      {photos.length > 1 && (
        <div className="listing-thumbs">
          {photos.map((photo, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Show photo ${i + 1}`}
              aria-pressed={i === index}
              onClick={() => setShown(i)}
            >
              <img src={photo} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
