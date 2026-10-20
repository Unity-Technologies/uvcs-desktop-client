// Decoded pixels as a BMP file, which the browser paints itself (`<img>` from a blob URL) where it can't decode the
// original (TGA, TIFF, EXR, HDR, PSD). BMP, as the one format the browser reads that holds the pixels as they are: no
// compression to spend time on, nothing lost, and alpha kept apart from color (a PNG made through a canvas would be
// premultiplied, losing the color of every see-through pixel). 32 bits a pixel with an alpha mask (BI_BITFIELDS in a
// BITMAPV4HEADER: the 40-byte header has no room for the alpha mask), the top row first (a negative height), sRGB.

export interface RgbaPixels {
  width: number;
  height: number;
  /** Red, green, blue and alpha, a byte each, the top row first. */
  rgba: Uint8ClampedArray;
}

const FILE_HEADER_BYTES = 14;
const V4_HEADER_BYTES = 108;
const PIXELS_AT = FILE_HEADER_BYTES + V4_HEADER_BYTES;
const BI_BITFIELDS = 3;
/** `LCS_sRGB`, the color space the header's `bV4CSType` names: the bytes `sRGB` read as a little-endian number. */
const LCS_SRGB = 0x73524742;
/** 72 DPI, in pixels per meter. */
const PIXELS_PER_METER = 2835;

export function bmpOf({ width, height, rgba }: RgbaPixels): Uint8Array {
  const pixelBytes = width * height * 4;
  const bytes = new Uint8Array(PIXELS_AT + pixelBytes);
  const view = new DataView(bytes.buffer);
  bytes.set([0x42, 0x4d]);
  view.setUint32(2, bytes.length, true);
  view.setUint32(10, PIXELS_AT, true);
  view.setUint32(14, V4_HEADER_BYTES, true);
  view.setInt32(18, width, true);
  view.setInt32(22, -height, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, 32, true);
  view.setUint32(30, BI_BITFIELDS, true);
  view.setUint32(34, pixelBytes, true);
  view.setInt32(38, PIXELS_PER_METER, true);
  view.setInt32(42, PIXELS_PER_METER, true);
  // Each pixel is read as a little-endian 32-bit number: blue in its lowest byte, alpha in its highest.
  view.setUint32(54, 0x00ff0000, true);
  view.setUint32(58, 0x0000ff00, true);
  view.setUint32(62, 0x000000ff, true);
  view.setUint32(66, 0xff000000, true);
  view.setUint32(70, LCS_SRGB, true);
  for (let from = 0, to = PIXELS_AT; from < pixelBytes; from += 4, to += 4) {
    bytes[to] = rgba[from + 2]!;
    bytes[to + 1] = rgba[from + 1]!;
    bytes[to + 2] = rgba[from]!;
    bytes[to + 3] = rgba[from + 3]!;
  }
  return bytes;
}
