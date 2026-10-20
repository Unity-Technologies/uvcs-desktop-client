// A Photoshop file's composite image (the flattened picture Photoshop saves after the layers), which is what a texture
// shows, read with no library. The file, big-endian: a 26-byte header (`8BPS`, version 1 for PSD or 2 for PSB, the
// channels, height, width, bits per channel and color mode), then three sections each led by its length (color mode
// data, image resources, layers and masks: the last one's length is 8 bytes in PSB), then the composite: its
// compression (0 raw, 1 RLE: every row of every channel PackBits-encoded, its byte count listed first, 2 bytes each
// in PSD and 4 in PSB), and the channels one after another (planar), each row by row. Photoshop leaves the composite
// blank when "Maximize Compatibility" is off, and says so in an image resource (1057, Version Info:
// `hasRealMergedData`).

export type PsdRead =
  | { kind: 'image'; width: number; height: number; rgba: Uint8ClampedArray }
  /** Saved without "Maximize Compatibility": only the layers hold the picture. */
  | { kind: 'noComposite' }
  /** CMYK, Lab, indexed, bitmap, or 32 bits per channel. */
  | { kind: 'unsupportedMode' }
  | { kind: 'unreadable' };

const GRAYSCALE = 1;
const RGB = 3;
const VERSION_INFO = 0x0421;
const RAW = 0;
const RLE = 1;

export function readPsd(bytes: Uint8Array): PsdRead {
  try {
    return read(bytes);
  } catch {
    // A section past the file's end: a truncated or damaged file.
    return { kind: 'unreadable' };
  }
}

function read(bytes: Uint8Array): PsdRead {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (String.fromCharCode(...bytes.subarray(0, 4)) !== '8BPS') return { kind: 'unreadable' };
  const version = view.getUint16(4);
  if (version !== 1 && version !== 2) return { kind: 'unreadable' };
  const channels = view.getUint16(12);
  const height = view.getUint32(14);
  const width = view.getUint32(18);
  const depth = view.getUint16(22);
  const mode = view.getUint16(24);
  if ((mode !== GRAYSCALE && mode !== RGB) || (depth !== 8 && depth !== 16)) return { kind: 'unsupportedMode' };
  const colors = mode === RGB ? 3 : 1;
  if (channels < colors || width === 0 || height === 0) return { kind: 'unreadable' };

  let at = 26;
  at += 4 + view.getUint32(at);
  const resourcesLength = view.getUint32(at);
  if (!hasRealMergedData(bytes, view, at + 4, at + 4 + resourcesLength)) return { kind: 'noComposite' };
  at += 4 + resourcesLength;
  at += version === 2 ? 8 + Number(view.getBigUint64(at)) : 4 + view.getUint32(at);
  if (at > bytes.length) return { kind: 'unreadable' };
  // The file ends with its layers: no composite at all.
  if (at + 2 > bytes.length) return { kind: 'noComposite' };

  // The color channels, then an alpha channel when there is one more: the transparency of the flattened picture.
  const shown = Math.min(channels, colors + 1);
  const planes = readPlanes(bytes, view, at, { channels, shown, width, height, depth, countBytes: version === 2 ? 4 : 2 });
  if (!planes) return { kind: 'unreadable' };
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel++) {
    const out = pixel * 4;
    if (colors === 3) {
      rgba[out] = planes[0]![pixel]!;
      rgba[out + 1] = planes[1]![pixel]!;
      rgba[out + 2] = planes[2]![pixel]!;
    } else {
      rgba[out] = rgba[out + 1] = rgba[out + 2] = planes[0]![pixel]!;
    }
    rgba[out + 3] = shown > colors ? planes[colors]![pixel]! : 255;
  }
  return { kind: 'image', width, height, rgba };
}

interface Layout {
  channels: number;
  /** How many of the first channels to read. */
  shown: number;
  width: number;
  height: number;
  depth: 8 | 16 | number;
  /** The size of each row's byte count in RLE: 2 in PSD, 4 in PSB. */
  countBytes: 2 | 4;
}

/** The first `shown` channels as 8-bit planes (a 16-bit sample's high byte), or null for a compression not read. */
function readPlanes(bytes: Uint8Array, view: DataView, start: number, layout: Layout): Uint8Array[] | null {
  const { channels, shown, width, height, depth, countBytes } = layout;
  const compression = view.getUint16(start);
  const sampleBytes = depth / 8;
  const rowBytes = width * sampleBytes;
  const planes = Array.from({ length: shown }, () => new Uint8Array(width * height));
  const row = new Uint8Array(rowBytes);
  if (compression === RAW) {
    let at = start + 2;
    if (at + shown * height * rowBytes > bytes.length) throw new RangeError('Truncated');
    for (let channel = 0; channel < shown; channel++) {
      for (let y = 0; y < height; y++, at += rowBytes) toPlane(bytes.subarray(at, at + rowBytes), planes[channel]!, y * width, sampleBytes);
    }
    return planes;
  }
  if (compression !== RLE) return null;
  const counts = start + 2;
  let at = counts + channels * height * countBytes;
  for (let channel = 0; channel < shown; channel++) {
    for (let y = 0; y < height; y++) {
      const index = channel * height + y;
      const length = countBytes === 2 ? view.getUint16(counts + index * 2) : view.getUint32(counts + index * 4);
      if (at + length > bytes.length) throw new RangeError('Truncated');
      unpackBits(bytes.subarray(at, at + length), row);
      toPlane(row, planes[channel]!, y * width, sampleBytes);
      at += length;
    }
  }
  return planes;
}

/** A row's samples into the plane at `offset`: a 16-bit sample (big-endian) by its high byte. */
function toPlane(samples: Uint8Array, plane: Uint8Array, offset: number, sampleBytes: number): void {
  if (sampleBytes === 1) plane.set(samples, offset);
  else for (let x = 0; x * 2 < samples.length; x++) plane[offset + x] = samples[x * 2]!;
}

/** PackBits: a header byte n, then n + 1 bytes as they are (n < 128), or the next byte 257 - n times (n > 128). */
function unpackBits(packed: Uint8Array, into: Uint8Array): void {
  let out = 0;
  for (let at = 0; at < packed.length && out < into.length; ) {
    const header = packed[at++]!;
    if (header < 128) {
      const run = Math.min(header + 1, into.length - out, packed.length - at);
      into.set(packed.subarray(at, at + run), out);
      at += header + 1;
      out += run;
    } else if (header > 128) {
      const run = Math.min(257 - header, into.length - out);
      into.fill(packed[at++]!, out, out + run);
      out += run;
    }
  }
  into.fill(0, out);
}

/** False only when the image resources say the composite isn't real (Version Info's `hasRealMergedData` is 0). */
function hasRealMergedData(bytes: Uint8Array, view: DataView, start: number, end: number): boolean {
  for (let at = start; at + 12 <= end; ) {
    if (String.fromCharCode(...bytes.subarray(at, at + 4)) !== '8BIM') return true;
    const id = view.getUint16(at + 4);
    const nameLength = bytes[at + 6]!;
    const dataAt = at + 6 + even(1 + nameLength);
    const size = view.getUint32(dataAt);
    if (id === VERSION_INFO && size >= 5) return bytes[dataAt + 4 + 4] !== 0;
    at = dataAt + 4 + even(size);
  }
  return true;
}

function even(length: number): number {
  return length + (length % 2);
}
