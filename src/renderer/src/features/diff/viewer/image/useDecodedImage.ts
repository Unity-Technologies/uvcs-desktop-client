// Decode a data URL into a ready-to-paint image and its natural pixel size.
// The viewer positions layers before painting them (centered offsets in the
// composed frame), so it needs sizes as data, not just an <img> that sizes
// itself.

import { useEffect, useState } from 'react';
import { decodedSize } from './decodedSize';

export interface DecodedImage {
  /** The data URL, ready for <img src>. */
  src: string;
  /** The decoded element — the differences mode draws it onto a canvas. */
  el: HTMLImageElement;
  width: number;
  height: number;
}

export type DecodeState =
  | { status: 'idle' } // no side to decode (added/deleted)
  | { status: 'loading' }
  | { status: 'ready'; image: DecodedImage }
  | { status: 'error' };

export function useDecodedImage(dataUrl: string | null | undefined): DecodeState {
  const [state, setState] = useState<DecodeState>({ status: 'idle' });

  useEffect(() => {
    if (!dataUrl) {
      setState({ status: 'idle' });
      return;
    }
    setState({ status: 'loading' });
    let stale = false;
    const img = new Image();
    img.onload = () => {
      if (stale) return;
      const size = decodedSize({ width: img.naturalWidth, height: img.naturalHeight }, dataUrl.startsWith('data:image/svg+xml'));
      setState({ status: 'ready', image: { src: dataUrl, el: img, ...size } });
    };
    img.onerror = () => {
      if (!stale) setState({ status: 'error' });
    };
    img.src = dataUrl;
    return () => {
      stale = true;
    };
  }, [dataUrl]);

  return state;
}
