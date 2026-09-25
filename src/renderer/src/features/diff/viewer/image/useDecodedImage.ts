// Decode a data URL into a ready-to-paint image and its natural pixel size.
// The viewer positions layers before painting them (centered offsets in the
// composed frame), so it needs sizes as data, not just an <img> that sizes
// itself.

import { useEffect, useState } from 'react';

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

/** SVGs without width/height decode as 0×0; give them a sane canvas. */
const FALLBACK_SIZE = { width: 300, height: 150 };

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
      setState({
        status: 'ready',
        image: {
          src: dataUrl,
          el: img,
          width: img.naturalWidth || FALLBACK_SIZE.width,
          height: img.naturalHeight || FALLBACK_SIZE.height,
        },
      });
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
