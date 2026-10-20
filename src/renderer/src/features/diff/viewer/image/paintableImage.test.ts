import { describe, expect, it } from 'vitest';
import { DECODED_IMAGE_TYPES, type ImageBytes } from '@shared/domain/content';
import { writeExr, writeHdr, writeTga, writeTiff, type Pixel } from '../../../../lib/images/testing/imageWriters';
import { writePsd } from '../../../../lib/images/testing/psdWriter';
import { paintableImage, type PaintableImage } from './paintableImage';

/** Three wide, two high: each pixel its own color, the top row bright, so a picture upside down shows. */
const pixel: Pixel = (x, y) => [x * 100, y === 0 ? 250 : 20, 60 + x * 10, 255];

const image = (bytes: Uint8Array, format: keyof typeof DECODED_IMAGE_TYPES): ImageBytes => ({ bytes, mimeType: DECODED_IMAGE_TYPES[format] });

/** The BMP's size and the pixel at x, y as RGBA (`bmpOf` writes BGRA, the top row first, after a 122-byte header). */
function painted(result: PaintableImage, x: number, y: number): { width: number; height: number; rgba: number[] } {
  if (result.status !== 'paintable') throw new Error(`Not decoded: ${result.problem}`);
  expect(result.image.mimeType).toBe('image/bmp');
  const view = new DataView(result.image.bytes.buffer, result.image.bytes.byteOffset);
  const width = view.getInt32(18, true);
  const at = 122 + (y * width + x) * 4;
  const [blue, green, red, alpha] = result.image.bytes.subarray(at, at + 4);
  return { width, height: -view.getInt32(22, true), rgba: [red!, green!, blue!, alpha!] };
}

describe('paintableImage', () => {
  it('paints a TGA, a TIFF and a PSD as they are, the top row first', () => {
    const psd = writePsd({ width: 3, height: 2, mode: 'rgb', alpha: true, compression: 'rle', sample: (x, y, channel) => pixel(x, y)[channel]! });
    for (const decoded of [paintableImage(image(writeTga(3, 2, pixel), 'tga')), paintableImage(image(writeTiff(3, 2, pixel), 'tiff')), paintableImage(image(psd, 'psd'))]) {
      expect(painted(decoded, 2, 1)).toEqual({ width: 3, height: 2, rgba: pixel(2, 1) });
      expect(painted(decoded, 1, 0).rgba).toEqual(pixel(1, 0));
      expect(decoded).toMatchObject({ highDynamicRange: false });
    }
  });

  it('paints an EXR and a Radiance HDR clamped to 0-1, and says their values are more than what shows', () => {
    const bright: Pixel = (x) => [255, x * 100, 0, 255];
    for (const decoded of [paintableImage(image(writeExr(3, 2, bright), 'exr')), paintableImage(image(writeHdr(3, 2, bright), 'hdr'))]) {
      expect(painted(decoded, 0, 0).rgba).toEqual([255, 0, 0, 255]);
      expect(decoded).toMatchObject({ highDynamicRange: true });
    }
  });

  it('goes by the content first: a PNG saved under a texture name paints as the PNG it is', () => {
    const png = image(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]), 'tga');
    expect(paintableImage(png)).toEqual({ status: 'paintable', image: png, highDynamicRange: false });
    const tiffNamedPsd = paintableImage(image(writeTiff(3, 2, pixel), 'psd'));
    expect(painted(tiffNamedPsd, 0, 1).rgba).toEqual(pixel(0, 1));
  });

  it('says why a Photoshop file it can read no composite of fails', () => {
    const blank = writePsd({ width: 3, height: 2, mode: 'rgb', realComposite: false, sample: () => 0 });
    expect(paintableImage(image(blank, 'psd'))).toEqual({ status: 'failed', problem: 'psdWithoutComposite' });
    const cmyk = writePsd({ width: 3, height: 2, mode: 'rgb', sample: () => 0 });
    cmyk[25] = 4;
    expect(paintableImage(image(cmyk, 'psd'))).toEqual({ status: 'failed', problem: 'psdColorMode' });
  });

  it('refuses an image whose header claims more pixels than are decoded, before decoding it', () => {
    const header = writeTga(1, 1, pixel);
    new DataView(header.buffer).setUint16(12, 20000, true);
    expect(paintableImage(image(header, 'tga'))).toEqual({ status: 'failed', problem: 'tooLarge' });
  });

  it('fails bytes that are no image of their type, and a type it has no decoder for', () => {
    expect(paintableImage(image(new Uint8Array([1, 2, 3]), 'tga'))).toEqual({ status: 'failed', problem: 'unreadable' });
    expect(paintableImage(image(new Uint8Array([0x49, 0x49, 42, 0, 1, 2]), 'tiff'))).toEqual({ status: 'failed', problem: 'unreadable' });
    expect(paintableImage({ bytes: new Uint8Array([1, 2, 3]), mimeType: 'image/x-dds' })).toEqual({ status: 'failed', problem: 'unsupportedFormat' });
  });
});
