import { describe, expect, it } from 'vitest';
import type { ImageBytes } from '@shared/domain/content';
import { shownPaint, type KeptPaint } from './usePaintableImage';

const psd = (byte: number): ImageBytes => ({ bytes: new Uint8Array([byte]), mimeType: 'image/vnd.adobe.photoshop' });
const decoded = (image: ImageBytes): KeptPaint => ({ image, painted: { status: 'paintable', blob: new Blob([new Uint8Array([0x42, 0x4d])]), highDynamicRange: false } });

async function paintedBytes(image: ImageBytes): Promise<{ type: string; bytes: number[] }> {
  const shown = shownPaint(image, undefined);
  if (shown.status !== 'paintable') throw new Error(`Not painted at once: ${shown.status}`);
  return { type: shown.blob.type, bytes: [...new Uint8Array(await shown.blob.arrayBuffer())] };
}

describe('shownPaint', () => {
  it('paints an image the browser decodes as it is, at once', async () => {
    expect(await paintedBytes({ bytes: new Uint8Array([0x89]), mimeType: 'image/png' })).toEqual({ type: 'image/png', bytes: [0x89] });
  });

  it('paints a texture whose bytes are a PNG at once, with no trip to the worker', async () => {
    const png = [0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10];
    expect(await paintedBytes({ bytes: new Uint8Array(png), mimeType: 'image/x-tga' })).toEqual({ type: 'image/x-tga', bytes: png });
  });

  it('paints a texture format once decoded, and what its decode failed with', () => {
    const image = psd(1);
    expect(shownPaint(image, undefined)).toEqual({ status: 'decoding' });
    const kept = decoded(image);
    expect(shownPaint(image, kept)).toBe(kept.painted);
    expect(shownPaint(image, { image, painted: { status: 'failed', problem: 'psdWithoutComposite' } })).toEqual({ status: 'failed', problem: 'psdWithoutComposite' });
  });

  it('never paints the image before while the next one decodes, and nothing without an image', () => {
    expect(shownPaint(psd(2), decoded(psd(1)))).toEqual({ status: 'decoding' });
    expect(shownPaint(undefined, decoded(psd(1)))).toEqual({ status: 'none' });
  });
});
