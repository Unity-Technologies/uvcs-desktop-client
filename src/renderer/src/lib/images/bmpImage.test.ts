import { describe, expect, it } from 'vitest';
import { bmpOf } from './bmpImage';
import { imageFormatOfContent, imageSizeOf } from './imageFormats';

/** Two wide, two high, the top row first: red and half-transparent green, then blue and see-through white. */
const pixels = { width: 2, height: 2, rgba: new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 128, 0, 0, 255, 255, 255, 255, 255, 0]) };

describe('bmpOf', () => {
  it("writes a BMP the browser reads, of the pixels' size", () => {
    const bmp = bmpOf(pixels);
    expect(imageFormatOfContent(bmp)).toBe('browser');
    expect(imageSizeOf(bmp, 'browser')).toEqual({ width: 2, height: 2 });
    expect(bmp.length).toBe(14 + 108 + 2 * 2 * 4);
  });

  it('stores 32 bits a pixel with an alpha mask, the top row first', () => {
    const view = new DataView(bmpOf(pixels).buffer);
    expect(view.getUint32(10, true)).toBe(122);
    expect(view.getUint32(14, true)).toBe(108);
    expect(view.getInt32(22, true)).toBe(-2);
    expect(view.getUint16(28, true)).toBe(32);
    expect(view.getUint32(30, true)).toBe(3);
    expect([54, 58, 62, 66].map((at) => view.getUint32(at, true))).toEqual([0x00ff0000, 0x0000ff00, 0x000000ff, 0xff000000]);
  });

  it("keeps each pixel's color and alpha as they are, a see-through one's color too", () => {
    const bmp = bmpOf(pixels);
    expect([...bmp.subarray(122)]).toEqual([0, 0, 255, 255, 0, 255, 0, 128, 255, 0, 0, 255, 255, 255, 255, 0]);
  });
});
