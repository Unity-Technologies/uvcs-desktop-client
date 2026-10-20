import { describe, expect, it } from 'vitest';
import type { ImageBytes } from '@shared/domain/content';
import { shownPaint, type KeptPaint } from './usePaintableImage';

const psd = (byte: number): ImageBytes => ({ bytes: new Uint8Array([byte]), mimeType: 'image/vnd.adobe.photoshop' });
const bmp: ImageBytes = { bytes: new Uint8Array([0x42, 0x4d]), mimeType: 'image/bmp' };
const decoded = (image: ImageBytes): KeptPaint => ({ image, painted: { status: 'paintable', image: bmp, highDynamicRange: false } });

describe('shownPaint', () => {
  it('paints an image the browser decodes as it is, at once', () => {
    const png: ImageBytes = { bytes: new Uint8Array([0x89]), mimeType: 'image/png' };
    expect(shownPaint(png, undefined)).toEqual({ status: 'paintable', image: png, highDynamicRange: false });
  });

  it('paints a texture format once decoded, and what its decode failed with', () => {
    const image = psd(1);
    expect(shownPaint(image, undefined)).toEqual({ status: 'decoding' });
    expect(shownPaint(image, decoded(image))).toEqual(decoded(image).painted);
    expect(shownPaint(image, { image, painted: { status: 'failed', problem: 'psdWithoutComposite' } })).toEqual({ status: 'failed', problem: 'psdWithoutComposite' });
  });

  it('never paints the image before while the next one decodes, and nothing without an image', () => {
    expect(shownPaint(psd(2), decoded(psd(1)))).toEqual({ status: 'decoding' });
    expect(shownPaint(undefined, decoded(psd(1)))).toEqual({ status: 'none' });
  });
});
