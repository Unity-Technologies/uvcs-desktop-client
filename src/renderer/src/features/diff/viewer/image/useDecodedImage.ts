// Decode an image into a ready-to-paint element and its natural pixel size.
// The viewer positions layers before painting them (centered offsets in the
// composed frame), so it needs sizes as data, not just an <img> that sizes
// itself.

import { useEffect, useState } from 'react';
import type { ImageBytes } from '@shared/domain/content';
import { decodedSize } from './decodedSize';
import { useImageUrl } from './useImageUrl';

export interface DecodedImage {
  /** The image's blob URL, ready for <img src> while the image is shown. */
  src: string;
  /** The decoded element — the differences mode draws it onto a canvas. */
  element: HTMLImageElement;
  width: number;
  height: number;
}

export type DecodeState =
  | { status: 'idle' } // no side to decode (added/deleted)
  | { status: 'loading' }
  | { status: 'ready'; image: DecodedImage }
  | { status: 'error' };

/** A decode's outcome, kept with the URL it read. */
export interface KeptDecode {
  url: string;
  state: DecodeState;
}

const IDLE: DecodeState = { status: 'idle' };
const LOADING: DecodeState = { status: 'loading' };

/**
 * What shows for the image: the decode kept for its current URL, or loading while that URL is made and read. Never a
 * decode of a URL the image had before: `useImageUrl` revokes it as the image changes, and an `<img>` painted with it
 * then fails to load (`ERR_FILE_NOT_FOUND`), as clicking fast from one image file to the next did.
 */
export function shownDecodeState(image: ImageBytes | undefined, url: string | undefined, kept: KeptDecode | undefined): DecodeState {
  if (!image) return IDLE;
  return url !== undefined && kept?.url === url ? kept.state : LOADING;
}

export function useDecodedImage(image: ImageBytes | undefined): DecodeState {
  const url = useImageUrl(image);
  const [kept, setKept] = useState<KeptDecode>();

  useEffect(() => {
    if (!image || !url) return;
    let stale = false;
    const img = new Image();
    img.onload = () => {
      if (stale) return;
      const size = decodedSize({ width: img.naturalWidth, height: img.naturalHeight }, image.mimeType === 'image/svg+xml');
      setKept({ url, state: { status: 'ready', image: { src: url, element: img, ...size } } });
    };
    img.onerror = () => {
      if (!stale) setKept({ url, state: { status: 'error' } });
    };
    img.src = url;
    return () => {
      stale = true;
    };
  }, [image, url]);

  return shownDecodeState(image, url, kept);
}
