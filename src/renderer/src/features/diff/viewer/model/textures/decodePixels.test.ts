import { describe, expect, it } from 'vitest';
import { decodePixels } from './decodePixels';
import { writeExr, writeHdr, writeTga, writeTiff, type Pixel } from './testing/imageWriters';
import { writePsd } from './testing/psdWriter';

/** Three wide, two high: each pixel its own color, the top row bright, so a picture upside down shows. */
const pixel: Pixel = (x, y) => [x * 100, y === 0 ? 250 : 20, 60 + x * 10, 255 - y * 100];

/** The pixel at x, y of an RGBA image whose top row comes first. */
function at(read: ReturnType<typeof decodePixels>, x: number, y: number): number[] {
  if (read.kind !== 'image') throw new Error(`Not decoded: ${read.problem}`);
  const start = (y * read.width + x) * 4;
  return [...read.rgba.subarray(start, start + 4)];
}

/** sRGB bytes back to the linear value an HDR format stored, for comparing with what was written. */
const linear = (byte: number): number => {
  const value = byte / 255;
  return Math.round((value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4) * 255);
};

describe('decodePixels', () => {
  it.each([true, false])('reads a TGA the top row first, whichever row it stores first (bottom up: %s)', (bottomUp) => {
    const read = decodePixels(writeTga(3, 2, pixel, { bottomUp }), 'tga');
    expect(at(read, 0, 0)).toEqual(pixel(0, 0));
    expect(at(read, 2, 1)).toEqual(pixel(2, 1));
  });

  it('reads a TIFF the top row first', () => {
    const read = decodePixels(writeTiff(3, 2, pixel), 'tiff');
    expect(at(read, 1, 0)).toEqual(pixel(1, 0));
    expect(at(read, 2, 1)).toEqual(pixel(2, 1));
  });

  it("reads an EXR the top row first, its linear light as sRGB, though EXRLoader gives WebGL's bottom row first", () => {
    const read = decodePixels(writeExr(3, 2, pixel), 'exr');
    expect(at(read, 2, 0).slice(0, 3).map(linear)).toEqual(pixel(2, 0).slice(0, 3));
    expect(at(read, 2, 0)[3]).toBe(255);
    expect(at(read, 0, 1).slice(0, 3).map(linear)).toEqual(pixel(0, 1).slice(0, 3));
  });

  it('reads a Radiance HDR the top row first, as sRGB', () => {
    const read = decodePixels(writeHdr(3, 2, pixel), 'hdr');
    // RGBE keeps 8 bits of mantissa for the brightest channel: the others within a step or two.
    at(read, 2, 0)
      .slice(0, 3)
      .map(linear)
      .forEach((value, channel) => expect(Math.abs(value - pixel(2, 0)[channel]!)).toBeLessThanOrEqual(2));
    expect(at(read, 1, 1).slice(0, 3).map(linear)[1]).toBeLessThan(at(read, 1, 0).slice(0, 3).map(linear)[1]!);
  });

  it('reads a PSD, and tells why one is unreadable', () => {
    const psd = writePsd({ width: 3, height: 2, mode: 'rgb', alpha: true, compression: 'rle', sample: (x, y, channel) => pixel(x, y)[channel]! });
    expect(at(decodePixels(psd, 'psd'), 2, 1)).toEqual(pixel(2, 1));
    expect(decodePixels(writePsd({ width: 3, height: 2, mode: 'rgb', realComposite: false, sample: () => 0 }), 'psd')).toEqual({ kind: 'failed', problem: 'psdWithoutComposite' });
  });

  it('tells bytes that are no image of their format', () => {
    for (const format of ['tga', 'tiff', 'exr', 'hdr', 'psd'] as const) expect(decodePixels(new Uint8Array([1, 2, 3, 4]), format)).toEqual({ kind: 'failed', problem: 'unreadable' });
  });
});
