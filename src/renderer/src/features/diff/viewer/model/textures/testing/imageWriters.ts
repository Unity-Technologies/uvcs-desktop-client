// Writes small images in the formats a browser can't decode, laid out as their specifications have them, for tests
// and the models sandbox: TGA (uncompressed, either row order), TIFF (baseline, uncompressed RGBA), OpenEXR (scanline,
// uncompressed, 32-bit float channels) and Radiance HDR (flat RGBE). Each takes a pixel's RGBA (0-255, the top row
// first). Never shipped in the app.

export type Pixel = (x: number, y: number) => [number, number, number, number];

/** `bottomUp`: rows from the bottom, TGA's default origin; otherwise the descriptor's top-left bit is set. */
export function writeTga(width: number, height: number, pixel: Pixel, { bottomUp = true } = {}): Uint8Array {
  const bytes = new Uint8Array(18 + width * height * 4);
  const view = new DataView(bytes.buffer);
  bytes[2] = 2;
  view.setUint16(12, width, true);
  view.setUint16(14, height, true);
  bytes[16] = 32;
  bytes[17] = 8 | (bottomUp ? 0 : 0x20);
  let at = 18;
  for (let row = 0; row < height; row++) {
    const y = bottomUp ? height - 1 - row : row;
    for (let x = 0; x < width; x++, at += 4) {
      const [r, g, b, a] = pixel(x, y);
      bytes.set([b, g, r, a], at);
    }
  }
  return bytes;
}

export function writeTiff(width: number, height: number, pixel: Pixel): Uint8Array {
  const entries: [tag: number, type: number, count: number, value: number][] = [];
  const dataAt = 8;
  const data = width * height * 4;
  const bitsAt = dataAt + data;
  const directoryAt = bitsAt + 8;
  entries.push(
    [256, 4, 1, width],
    [257, 4, 1, height],
    [258, 3, 4, bitsAt],
    [259, 3, 1, 1],
    [262, 3, 1, 2],
    [273, 4, 1, dataAt],
    [277, 3, 1, 4],
    [278, 4, 1, height],
    [279, 4, 1, data],
    [284, 3, 1, 1],
    [338, 3, 1, 2],
  );
  const bytes = new Uint8Array(directoryAt + 2 + entries.length * 12 + 4);
  const view = new DataView(bytes.buffer);
  bytes.set([0x49, 0x49, 42, 0]);
  view.setUint32(4, directoryAt, true);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) bytes.set(pixel(x, y), dataAt + (y * width + x) * 4);
  for (let channel = 0; channel < 4; channel++) view.setUint16(bitsAt + channel * 2, 8, true);
  view.setUint16(directoryAt, entries.length, true);
  entries.forEach(([tag, type, count, value], i) => {
    const at = directoryAt + 2 + i * 12;
    view.setUint16(at, tag, true);
    view.setUint16(at + 2, type, true);
    view.setUint32(at + 4, count, true);
    if (type === 3 && count === 1) view.setUint16(at + 8, value, true);
    else view.setUint32(at + 8, value, true);
  });
  return bytes;
}

/** Linear values: a byte over 255, as an EXR keeps light. */
export function writeExr(width: number, height: number, pixel: Pixel): Uint8Array {
  const out = new Parts();
  out.bytes([0x76, 0x2f, 0x31, 0x01]).u32(2);
  const channels = ['A', 'B', 'G', 'R'];
  const list = new Parts();
  for (const name of channels) list.text(name).u32(2).bytes([0, 0, 0, 0]).u32(1).u32(1);
  list.bytes([0]);
  const box = new Parts().u32(0).u32(0).u32(width - 1).u32(height - 1).done();
  out.attribute('channels', 'chlist', list.done());
  out.attribute('compression', 'compression', new Uint8Array([0]));
  out.attribute('dataWindow', 'box2i', box);
  out.attribute('displayWindow', 'box2i', box);
  out.attribute('lineOrder', 'lineOrder', new Uint8Array([0]));
  out.attribute('pixelAspectRatio', 'float', new Parts().f32(1).done());
  out.attribute('screenWindowCenter', 'v2f', new Parts().f32(0).f32(0).done());
  out.attribute('screenWindowWidth', 'float', new Parts().f32(1).done());
  out.bytes([0]);
  const blockBytes = 8 + channels.length * width * 4;
  const tableEnd = out.length + height * 8;
  for (let y = 0; y < height; y++) out.u64(tableEnd + y * blockBytes);
  for (let y = 0; y < height; y++) {
    out.u32(y).u32(channels.length * width * 4);
    for (const channel of [3, 2, 1, 0]) for (let x = 0; x < width; x++) out.f32(pixel(x, y)[channel]! / 255);
  }
  return out.done();
}

/** Linear values, RGB (alpha isn't kept), flat RGBE pixels: what a writer does for images narrower than 8. */
export function writeHdr(width: number, height: number, pixel: Pixel): Uint8Array {
  const header = new TextEncoder().encode(`#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${height} +X ${width}\n`);
  const bytes = new Uint8Array(header.length + width * height * 4);
  bytes.set(header);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixel(x, y).map((value) => value / 255) as [number, number, number];
      const brightest = Math.max(r, g, b);
      const exponent = brightest < 1e-32 ? 0 : Math.ceil(Math.log2(brightest) + 1e-9);
      const scale = brightest < 1e-32 ? 0 : 256 / 2 ** exponent;
      bytes.set([Math.min(255, Math.floor(r * scale)), Math.min(255, Math.floor(g * scale)), Math.min(255, Math.floor(b * scale)), brightest < 1e-32 ? 0 : exponent + 128], header.length + (y * width + x) * 4);
    }
  }
  return bytes;
}

/** Little-endian parts, joined. */
class Parts {
  private readonly values: number[] = [];

  get length(): number {
    return this.values.length;
  }

  bytes(values: ArrayLike<number>): this {
    for (let i = 0; i < values.length; i++) this.values.push(values[i]!);
    return this;
  }

  text(value: string): this {
    return this.bytes([...new TextEncoder().encode(value), 0]);
  }

  u32(value: number): this {
    const bytes = new Uint8Array(4);
    new DataView(bytes.buffer).setUint32(0, value, true);
    return this.bytes(bytes);
  }

  u64(value: number): this {
    return this.u32(value >>> 0).u32(Math.floor(value / 0x100000000));
  }

  f32(value: number): this {
    const bytes = new Uint8Array(4);
    new DataView(bytes.buffer).setFloat32(0, value, true);
    return this.bytes(bytes);
  }

  attribute(name: string, type: string, value: Uint8Array): this {
    return this.text(name).text(type).u32(value.length).bytes(value);
  }

  done(): Uint8Array {
    return new Uint8Array(this.values);
  }
}
