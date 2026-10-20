import { describe, expect, it } from 'vitest';
import { shownDecodeState, type KeptDecode } from './useDecodedImage';
import type { PaintState } from './usePaintableImage';

const png = (byte: number): PaintState => ({ status: 'paintable', blob: new Blob([new Uint8Array([byte])], { type: 'image/png' }), highDynamicRange: false });
const ready = (url: string): KeptDecode => ({
  url,
  state: { status: 'ready', image: { src: url, element: {} as HTMLImageElement, width: 4, height: 3, highDynamicRange: false } },
});

describe('shownDecodeState', () => {
  it('shows the decode of the URL the image has now', () => {
    expect(shownDecodeState(png(1), 'blob:a', ready('blob:a'))).toEqual(ready('blob:a').state);
    expect(shownDecodeState(png(1), 'blob:a', { url: 'blob:a', state: { status: 'error', problem: 'unreadable' } })).toEqual({ status: 'error', problem: 'unreadable' });
  });

  it('never shows the URL of the image before, revoked as the image changes, while the next one is made or read', () => {
    const before = ready('blob:a');
    expect(shownDecodeState(png(2), undefined, before)).toEqual({ status: 'loading' });
    expect(shownDecodeState(png(2), 'blob:b', before)).toEqual({ status: 'loading' });
  });

  it('is loading until a first decode, and idle without an image (a side added or deleted)', () => {
    expect(shownDecodeState(png(1), 'blob:a', undefined)).toEqual({ status: 'loading' });
    expect(shownDecodeState({ status: 'none' }, undefined, ready('blob:a'))).toEqual({ status: 'idle' });
  });

  it('is loading while a texture format decodes in the worker, and fails with why it could not', () => {
    expect(shownDecodeState({ status: 'decoding' }, undefined, ready('blob:a'))).toEqual({ status: 'loading' });
    expect(shownDecodeState({ status: 'failed', problem: 'psdColorMode' }, undefined, undefined)).toEqual({ status: 'error', problem: 'psdColorMode' });
  });
});
