import { useEffect, useState } from 'react';
import type { ImageBytes } from '@shared/domain/content';

/**
 * A blob URL for an image's bytes while the component shows it, revoked once it doesn't (another image, unmounted): a
 * data URL of a 25 MB PNG was 35 MB of text to build, keep and decode again. Undefined until the URL exists, and for
 * no image. Painted only through `<img>`, where an SVG runs no script and loads nothing.
 */
export function useImageUrl(image: ImageBytes | undefined): string | undefined {
  const [shown, setShown] = useState<{ image: ImageBytes; url: string }>();
  useEffect(() => {
    if (!image) return;
    const url = imageUrl(image);
    setShown({ image, url });
    return () => URL.revokeObjectURL(url);
  }, [image]);
  return shown && shown.image === image ? shown.url : undefined;
}

/** A new blob URL for the image, of its own type; the caller revokes it. */
export function imageUrl({ bytes, mimeType }: ImageBytes): string {
  return URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: mimeType }));
}
