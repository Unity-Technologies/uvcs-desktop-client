import { useEffect, useState } from 'react';

/**
 * A blob URL for an image while the component shows it, revoked once it doesn't (another image, unmounted): a data
 * URL of a 25 MB PNG was 35 MB of text to build, keep and decode again. Undefined until the URL exists, and for no
 * image. Painted only through `<img>`, where an SVG runs no script and loads nothing.
 */
export function useImageUrl(blob: Blob | undefined): string | undefined {
  const [shown, setShown] = useState<{ blob: Blob; url: string }>();
  useEffect(() => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    setShown({ blob, url });
    return () => URL.revokeObjectURL(url);
  }, [blob]);
  return shown && shown.blob === blob ? shown.url : undefined;
}
