// An image as the browser can paint it: the image itself for the types it decodes, or, for Unity's texture formats
// (`needsDecoding`), the image the decode worker makes of it (`paintableOffThread`). Whatever shows an image (the image
// diff, the merge page's previews) paints what this gives, from a blob URL (`useImageUrl`).

import { useEffect, useMemo, useState } from 'react';
import type { ImageBytes } from '@shared/domain/content';
import { needsDecoding } from './decodedImageTypes';
import { paintableOffThread } from './imageDecodeSession';
import type { PaintableImage } from './paintableImage';

export type PaintState = { status: 'none' } | { status: 'decoding' } | PaintableImage;

/** A decode's outcome, kept with the image it was made of. */
export interface KeptPaint {
  image: ImageBytes;
  painted: PaintableImage;
}

const NONE: PaintState = { status: 'none' };
const DECODING: PaintState = { status: 'decoding' };

/** What paints for the image now: never what was decoded of the image before, while this one decodes. */
export function shownPaint(image: ImageBytes | undefined, kept: KeptPaint | undefined): PaintState {
  if (!image) return NONE;
  if (!needsDecoding(image)) return { status: 'paintable', image, highDynamicRange: false };
  return kept?.image === image ? kept.painted : DECODING;
}

export function usePaintableImage(image: ImageBytes | undefined): PaintState {
  const [kept, setKept] = useState<KeptPaint>();
  useEffect(() => {
    if (!image || !needsDecoding(image)) return;
    let stale = false;
    void paintableOffThread(image).then((painted) => {
      if (!stale) setKept({ image, painted });
    });
    return () => {
      stale = true;
    };
  }, [image]);
  return useMemo(() => shownPaint(image, kept), [image, kept]);
}
