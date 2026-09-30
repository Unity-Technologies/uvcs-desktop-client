import { describe, expect, it } from 'vitest';
import type { ImageBytes } from '@shared/domain/content';
import { shownDecodeState, type KeptDecode } from './useDecodedImage';

const png = (byte: number): ImageBytes => ({ bytes: new Uint8Array([byte]), mimeType: 'image/png' });
const ready = (url: string): KeptDecode => ({ url, state: { status: 'ready', image: { src: url, element: {} as HTMLImageElement, width: 4, height: 3 } } });

describe('shownDecodeState', () => {
  it('shows the decode of the URL the image has now', () => {
    expect(shownDecodeState(png(1), 'blob:a', ready('blob:a'))).toEqual(ready('blob:a').state);
    expect(shownDecodeState(png(1), 'blob:a', { url: 'blob:a', state: { status: 'error' } })).toEqual({ status: 'error' });
  });

  it('never shows the URL of the image before, revoked as the image changes, while the next one is made or read', () => {
    const before = ready('blob:a');
    expect(shownDecodeState(png(2), undefined, before)).toEqual({ status: 'loading' });
    expect(shownDecodeState(png(2), 'blob:b', before)).toEqual({ status: 'loading' });
  });

  it('is loading until a first decode, and idle without an image (a side added or deleted)', () => {
    expect(shownDecodeState(png(1), 'blob:a', undefined)).toEqual({ status: 'loading' });
    expect(shownDecodeState(undefined, undefined, ready('blob:a'))).toEqual({ status: 'idle' });
  });
});
