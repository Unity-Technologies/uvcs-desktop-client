import { describe, expect, it } from 'vitest';
import { writeExr, writeHdr, writeTga, writeTiff } from './testing/imageWriters';
import { writePsd } from './testing/psdWriter';
import { imageFormatOf, imageSizeOf, sizeProblem } from './imageFormats';

const black = (): [number, number, number, number] => [0, 0, 0, 255];

/** Bytes as a header starts: the values given at their offsets, the rest zeros. */
function header(length: number, ...fields: [offset: number, write: (view: DataView) => void][]): Uint8Array {
  const bytes = new Uint8Array(length);
  const view = new DataView(bytes.buffer);
  for (const [, write] of fields) write(view);
  return bytes;
}

const ascii = (view: DataView, at: number, text: string) => [...text].forEach((character, i) => view.setUint8(at + i, character.charCodeAt(0)));

describe('imageFormatOf', () => {
  it('decodes the formats Unity projects use, by extension whatever its case, and no GPU format', () => {
    expect(['a.PNG', 'b.jpg', 'c.jpeg', 'd.tga', 'e.psd', 'f.PSB', 'g.exr', 'h.tif', 'i.hdr', 'j.dds', 'k.ktx', 'l'].map(imageFormatOf)).toEqual([
      'browser',
      'browser',
      'browser',
      'tga',
      'psd',
      'psd',
      'exr',
      'tiff',
      'hdr',
      'unsupported',
      'unsupported',
      'unsupported',
    ]);
  });
});

describe('imageSizeOf', () => {
  it("reads the size from each browser format's header", () => {
    const png = header(32, [0, (view) => [0x89, 0x50, 0x4e, 0x47].forEach((value, i) => view.setUint8(i, value))], [16, (view) => (view.setUint32(16, 4096), view.setUint32(20, 2048))]);
    expect(imageSizeOf(png, 'a.png')).toEqual({ width: 4096, height: 2048 });
    // JPEG: an APP0 segment, then the frame (SOF2, progressive) with height then width.
    const jpeg = header(40, [0, (view) => (view.setUint16(0, 0xffd8), view.setUint16(2, 0xffe0), view.setUint16(4, 16), view.setUint16(20, 0xffc2), view.setUint16(22, 17), view.setUint16(25, 300), view.setUint16(27, 500))]);
    expect(imageSizeOf(jpeg, 'a.jpg')).toEqual({ width: 500, height: 300 });
    const gif = header(16, [0, (view) => (ascii(view, 0, 'GIF89a'), view.setUint16(6, 64, true), view.setUint16(8, 32, true))]);
    expect(imageSizeOf(gif, 'a.gif')).toEqual({ width: 64, height: 32 });
    const bmp = header(30, [0, (view) => (ascii(view, 0, 'BM'), view.setUint32(14, 40, true), view.setInt32(18, 640, true), view.setInt32(22, -480, true))]);
    expect(imageSizeOf(bmp, 'a.bmp')).toEqual({ width: 640, height: 480 });
    const webp = header(32, [0, (view) => (ascii(view, 0, 'RIFF'), ascii(view, 8, 'WEBPVP8X'), view.setUint32(24, 1023, true), view.setUint32(27, 511, true))]);
    expect(imageSizeOf(webp, 'a.webp')).toEqual({ width: 1024, height: 512 });
  });

  it('reads the size of the formats three and the app decode', () => {
    expect(imageSizeOf(writeTga(7, 3, black), 'a.tga')).toEqual({ width: 7, height: 3 });
    expect(imageSizeOf(writeTiff(7, 3, black), 'a.tif')).toEqual({ width: 7, height: 3 });
    expect(imageSizeOf(writeExr(7, 3, black), 'a.exr')).toEqual({ width: 7, height: 3 });
    expect(imageSizeOf(writeHdr(7, 3, black), 'a.hdr')).toEqual({ width: 7, height: 3 });
    expect(imageSizeOf(writePsd({ width: 7, height: 3, mode: 'gray', sample: () => 0 }), 'a.psd')).toEqual({ width: 7, height: 3 });
  });

  it("tells nothing of bytes whose header isn't their format's", () => {
    expect(imageSizeOf(new Uint8Array([1, 2, 3]), 'a.png')).toBeNull();
    expect(imageSizeOf(new Uint8Array(4), 'a.tga')).toBeNull();
    expect(imageSizeOf(new Uint8Array([0xff, 0xd8, 0x00, 0x00, 0, 0, 0, 0, 0, 0, 0]), 'a.jpg')).toBeNull();
  });
});

describe('sizeProblem', () => {
  it('refuses before decoding an image past 16384 px on a side or 8192² pixels', () => {
    expect(sizeProblem({ width: 16384, height: 4096 })).toBeNull();
    expect(sizeProblem({ width: 16385, height: 16 })).toBe('tooLarge');
    expect(sizeProblem({ width: 16384, height: 16384 })).toBe('tooLarge');
  });
});
