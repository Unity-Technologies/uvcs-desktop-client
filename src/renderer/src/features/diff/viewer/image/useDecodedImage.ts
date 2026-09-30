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

export function useDecodedImage(image: ImageBytes | undefined): DecodeState {
  const url = useImageUrl(image);
  const [state, setState] = useState<DecodeState>({ status: 'idle' });

  useEffect(() => {
    if (!image) {
      setState({ status: 'idle' });
      return;
    }
    setState({ status: 'loading' });
    if (!url) return;
    let stale = false;
    const img = new Image();
    img.onload = () => {
      if (stale) return;
      const size = decodedSize({ width: img.naturalWidth, height: img.naturalHeight }, image.mimeType === 'image/svg+xml');
      setState({ status: 'ready', image: { src: url, element: img, ...size } });
    };
    img.onerror = () => {
      if (!stale) setState({ status: 'error' });
    };
    img.src = url;
    return () => {
      stale = true;
    };
  }, [image, url]);

  return state;
}
