// Writes Photoshop files (PSD and PSB) as Photoshop lays them out, for tests and the models sandbox: the header, an
// empty color mode section, image resources (Version Info, telling whether the composite is real), a layer section
// of filler bytes (a reader must skip it whole), and the composite image, raw or RLE (PackBits), 8 or 16 bits per
// channel, grayscale or RGB, with an alpha channel or not. Never shipped in the app.

export interface PsdSpec {
  width: number;
  height: number;
  mode: 'gray' | 'rgb';
  /** Channels after the color ones: an alpha channel. */
  alpha?: boolean;
  depth?: 8 | 16;
  compression?: 'raw' | 'rle';
  /** PSB, Photoshop's large document format. */
  large?: boolean;
  /** False writes the composite blank, as Photoshop does without "Maximize Compatibility". */
  realComposite?: boolean;
  /** Bytes of the layer section, which a reader skips. */
  layerBytes?: number;
  /** A channel's 8-bit value at a pixel, the top row first. */
  sample: (x: number, y: number, channel: number) => number;
}

export function writePsd(spec: PsdSpec): Uint8Array {
  const { width, height, depth = 8, compression = 'raw', large = false } = spec;
  const channels = (spec.mode === 'rgb' ? 3 : 1) + (spec.alpha ? 1 : 0);
  const out = new Writer();
  out.ascii('8BPS').u16(large ? 2 : 1).zeros(6).u16(channels).u32(height).u32(width).u16(depth).u16(spec.mode === 'rgb' ? 3 : 1);
  out.u32(0);
  const versionInfo = new Writer().u32(1).u8(spec.realComposite === false ? 0 : 1).bytes();
  const resources = new Writer().ascii('8BIM').u16(0x0421).u8(0).u8(0).u32(versionInfo.length).raw(versionInfo).pad(versionInfo.length).bytes();
  out.u32(resources.length).raw(resources);
  const layers = new Uint8Array(spec.layerBytes ?? 0).fill(0x5a);
  if (large) out.u64(layers.length);
  else out.u32(layers.length);
  out.raw(layers);

  const rows: Uint8Array[][] = [];
  for (let channel = 0; channel < channels; channel++) {
    rows.push(
      Array.from({ length: height }, (_, y) => {
        const row = new Uint8Array(width * (depth / 8));
        for (let x = 0; x < width; x++) {
          const value = spec.realComposite === false ? 255 : spec.sample(x, y, channel);
          if (depth === 8) row[x] = value;
          else {
            row[x * 2] = value;
            row[x * 2 + 1] = value;
          }
        }
        return row;
      }),
    );
  }
  if (compression === 'raw') {
    out.u16(0);
    for (const channel of rows) for (const row of channel) out.raw(row);
  } else {
    out.u16(1);
    const packed = rows.map((channel) => channel.map(packBits));
    for (const channel of packed) for (const row of channel) (large ? out.u32(row.length) : out.u16(row.length));
    for (const channel of packed) for (const row of channel) out.raw(row);
  }
  return out.bytes();
}

/** PackBits: runs of three or more equal bytes as a repeat, the rest as literals, 128 bytes at most each. */
function packBits(row: Uint8Array): Uint8Array {
  const out: number[] = [];
  let at = 0;
  while (at < row.length) {
    let run = 1;
    while (at + run < row.length && run < 128 && row[at + run] === row[at]) run++;
    if (run >= 3) {
      out.push(257 - run, row[at]!);
      at += run;
      continue;
    }
    const start = at;
    while (at < row.length && at - start < 128 && !(at + 2 < row.length && row[at] === row[at + 1] && row[at] === row[at + 2])) at++;
    out.push(at - start - 1, ...row.subarray(start, at));
  }
  return new Uint8Array(out);
}

class Writer {
  private readonly parts: number[] = [];

  u8(value: number): this {
    this.parts.push(value & 0xff);
    return this;
  }

  u16(value: number): this {
    return this.u8(value >>> 8).u8(value);
  }

  u32(value: number): this {
    return this.u16(value >>> 16).u16(value & 0xffff);
  }

  u64(value: number): this {
    return this.u32(Math.floor(value / 0x100000000)).u32(value >>> 0);
  }

  ascii(text: string): this {
    for (const character of text) this.u8(character.charCodeAt(0));
    return this;
  }

  zeros(count: number): this {
    for (let i = 0; i < count; i++) this.u8(0);
    return this;
  }

  pad(length: number): this {
    return length % 2 === 1 ? this.u8(0) : this;
  }

  raw(bytes: Uint8Array): this {
    for (const value of bytes) this.parts.push(value);
    return this;
  }

  bytes(): Uint8Array {
    return new Uint8Array(this.parts);
  }
}
