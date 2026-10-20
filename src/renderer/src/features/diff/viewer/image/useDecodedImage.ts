// Decode an image into a ready-to-paint element and its natural pixel size.
// The viewer positions layers before painting them (centered offsets in the
// composed frame), so it needs sizes as data, not just an <img> that sizes
// itself. Unity's texture formats are decoded first, in a worker, into an
// image the browser paints (`usePaintableImage`).

import { useEffect, useState } from 'react';
import type { ImageBytes } from '@shared/domain/content';
import type { ImageProblem } from '../../../../lib/images/imageProblems';
import { decodedSize } from './decodedSize';
import { useImageUrl } from './useImageUrl';
import { usePaintableImage, type PaintState } from './usePaintableImage';

export interface DecodedImage {
  /** The image's blob URL, ready for <img src> while the image is shown. */
  src: string;
  /** The decoded element — the differences mode draws it onto a canvas. */
  element: HTMLImageElement;
  width: number;
  height: number;
  /** Clamped to 0–1 from a high dynamic range file (EXR, HDR): the colors shown and inspected aren't the file's values. */
  highDynamicRange: boolean;
}

export type DecodeState =
  | { status: 'idle' } // no side to decode (added/deleted)
  | { status: 'loading' }
  | { status: 'ready'; image: DecodedImage }
  | { status: 'error'; problem: ImageProblem };

/** A decode's outcome, kept with the URL it read. */
export interface KeptDecode {
  url: string;
  state: DecodeState;
}

const IDLE: DecodeState = { status: 'idle' };
const LOADING: DecodeState = { status: 'loading' };

/**
 * What shows for the image: the decode kept for its current URL, or loading while the image is made paintable or its
 * URL made and read. Never a decode of a URL the image had before: `useImageUrl` revokes it as the image changes, and
 * an `<img>` painted with it then fails to load (`ERR_FILE_NOT_FOUND`), as clicking fast from one image file to the
 * next did.
 */
export function shownDecodeState(paint: PaintState, url: string | undefined, kept: KeptDecode | undefined): DecodeState {
  switch (paint.status) {
    case 'none':
      return IDLE;
    case 'decoding':
      return LOADING;
    case 'failed':
      return { status: 'error', problem: paint.problem };
    case 'paintable':
      return url !== undefined && kept?.url === url ? kept.state : LOADING;
  }
}

export function useDecodedImage(image: ImageBytes | undefined): DecodeState {
  const paint = usePaintableImage(image);
  const url = useImageUrl(paint.status === 'paintable' ? paint.blob : undefined);
  const [kept, setKept] = useState<KeptDecode>();

  useEffect(() => {
    if (paint.status !== 'paintable' || !url) return;
    let stale = false;
    const img = new Image();
    img.onload = () => {
      if (stale) return;
      const size = decodedSize({ width: img.naturalWidth, height: img.naturalHeight }, paint.blob.type === 'image/svg+xml');
      setKept({ url, state: { status: 'ready', image: { src: url, element: img, ...size, highDynamicRange: paint.highDynamicRange } } });
    };
    img.onerror = () => {
      if (!stale) setKept({ url, state: { status: 'error', problem: 'unreadable' } });
    };
    img.src = url;
    return () => {
      stale = true;
    };
  }, [paint, url]);

  return shownDecodeState(paint, url, kept);
}
