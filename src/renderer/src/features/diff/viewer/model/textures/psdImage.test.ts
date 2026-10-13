import { describe, expect, it } from 'vitest';
import { readPsd } from './psdImage';
import { writePsd, type PsdSpec } from './testing/psdWriter';

/** A picture whose every pixel and channel differ: red across, green down, blue a checker, alpha by row. */
const sample = (x: number, y: number, channel: number): number => [x * 40, y * 50, (x + y) % 2 ? 200 : 10, 255 - y * 60][channel]!;

const picture = (spec: Partial<PsdSpec> = {}): Uint8Array => writePsd({ width: 5, height: 4, mode: 'rgb', sample, ...spec });

/** The RGBA a reader should give for the spec: the top row first. */
function expected({ width = 5, height = 4, mode = 'rgb', alpha = false }: Partial<PsdSpec>): number[] {
  const values: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const color = mode === 'rgb' ? [0, 1, 2].map((channel) => sample(x, y, channel)) : [0, 0, 0].map(() => sample(x, y, 0));
      values.push(...color, alpha ? sample(x, y, mode === 'rgb' ? 3 : 1) : 255);
    }
  }
  return values;
}

describe('readPsd', () => {
  it.each([
    { compression: 'raw', depth: 8 },
    { compression: 'rle', depth: 8 },
    { compression: 'raw', depth: 16 },
    { compression: 'rle', depth: 16 },
  ] as const)('reads an RGB composite, $compression at $depth bits', (spec) => {
    const read = readPsd(picture({ ...spec, layerBytes: 37 }));
    expect(read.kind === 'image' && { width: read.width, height: read.height, rgba: [...read.rgba] }).toEqual({ width: 5, height: 4, rgba: expected({}) });
  });

  it('reads the alpha channel after the colors as the transparency, and grayscale as gray', () => {
    const rgba = readPsd(picture({ alpha: true, compression: 'rle' }));
    expect(rgba.kind === 'image' && [...rgba.rgba]).toEqual(expected({ alpha: true }));
    const gray = readPsd(picture({ mode: 'gray', alpha: true, depth: 16 }));
    expect(gray.kind === 'image' && [...gray.rgba]).toEqual(expected({ mode: 'gray', alpha: true }));
  });

  it("reads a PSB: its layer section's 8-byte length and RLE rows' 4-byte counts", () => {
    for (const compression of ['raw', 'rle'] as const) {
      const read = readPsd(picture({ large: true, compression, layerBytes: 300 }));
      expect(read.kind === 'image' && [...read.rgba]).toEqual(expected({}));
    }
  });

  it('reads RLE rows a long run makes longer than 128 bytes', () => {
    const wide = writePsd({ width: 300, height: 2, mode: 'rgb', compression: 'rle', sample: (x, _y, channel) => (x < 200 ? 7 : x + channel) % 256 });
    const read = readPsd(wide);
    expect(read.kind === 'image' && [read.rgba[0], read.rgba[4 * 250], read.rgba[4 * 250 + 1]]).toEqual([7, 250, 251]);
  });

  it('tells a PSD saved without Maximize Compatibility, whose composite is blank', () => {
    expect(readPsd(picture({ realComposite: false }))).toEqual({ kind: 'noComposite' });
    // Header (26), color mode (4), the Version Info resource (22), an empty layer section (4): and nothing after.
    expect(readPsd(picture().subarray(0, 56))).toEqual({ kind: 'noComposite' });
  });

  it("tells a color mode or depth it doesn't read: CMYK, Lab, 32-bit", () => {
    const withHeader = (offset: number, value: number) => {
      const bytes = picture();
      new DataView(bytes.buffer).setUint16(offset, value);
      return bytes;
    };
    expect(readPsd(withHeader(24, 4))).toEqual({ kind: 'unsupportedMode' });
    expect(readPsd(withHeader(24, 9))).toEqual({ kind: 'unsupportedMode' });
    expect(readPsd(withHeader(22, 32))).toEqual({ kind: 'unsupportedMode' });
  });

  it('reads nothing from a truncated file or one that is no PSD', () => {
    const bytes = picture({ compression: 'rle' });
    expect(readPsd(bytes.subarray(0, bytes.length - 10))).toEqual({ kind: 'unreadable' });
    expect(readPsd(picture().subarray(0, 40))).toEqual({ kind: 'unreadable' });
    expect(readPsd(new TextEncoder().encode('not a psd at all, not even close'))).toEqual({ kind: 'unreadable' });
  });
});
