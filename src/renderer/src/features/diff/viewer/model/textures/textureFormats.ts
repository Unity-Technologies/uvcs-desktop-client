// The image formats a Unity project's textures come in, by file name, and each one's size read from its header before
// anything decodes it: a texture claiming 30000 × 30000 pixels is refused unread, never decoded into gigabytes.

/**
 * How a texture decodes: by the browser (`createImageBitmap`), by three's loaders (TGA, TIFF, EXR, Radiance HDR), by
 * the app's own reader (Photoshop's PSD and PSB), or not at all (DDS, KTX, anything else: GPU formats and the rare).
 */
export type TextureFormat = 'browser' | 'tga' | 'tiff' | 'exr' | 'hdr' | 'psd' | 'unsupported';

const FORMATS: Record<string, TextureFormat> = {
  png: 'browser',
  jpg: 'browser',
  jpeg: 'browser',
  gif: 'browser',
  bmp: 'browser',
  webp: 'browser',
  tga: 'tga',
  tif: 'tiff',
  tiff: 'tiff',
  exr: 'exr',
  hdr: 'hdr',
  psd: 'psd',
  psb: 'psd',
};

export function textureFormatOf(fileName: string): TextureFormat {
  const extension = /\.([^./\\]+)$/.exec(fileName)?.[1]?.toLowerCase() ?? '';
  return FORMATS[extension] ?? 'unsupported';
}

export interface ImageSize {
  width: number;
  height: number;
}

/** A side past this, or more pixels than this, is refused before decoding: decoding allocates every pixel at once. */
export const MAX_TEXTURE_SIDE = 16384;
export const MAX_TEXTURE_PIXELS = 8192 * 8192;

/** Why an image of this size isn't decoded; null when it may be. */
export function sizeProblem({ width, height }: ImageSize): 'tooLarge' | null {
  return width > MAX_TEXTURE_SIDE || height > MAX_TEXTURE_SIDE || width * height > MAX_TEXTURE_PIXELS ? 'tooLarge' : null;
}

/** The size the file's header says, or null when the header doesn't read as its format's. */
export function imageSizeOf(bytes: Uint8Array, fileName: string): ImageSize | null {
  try {
    const size = headerSize(bytes, fileName);
    return size && size.width > 0 && size.height > 0 && Number.isFinite(size.width) && Number.isFinite(size.height) ? size : null;
  } catch {
    return null;
  }
}

function headerSize(bytes: Uint8Array, fileName: string): ImageSize | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return { width: view.getUint32(16), height: view.getUint32(20) };
  if (startsWith(bytes, [0xff, 0xd8])) return jpegSize(bytes, view);
  if (ascii(bytes, 0, 4) === 'GIF8') return { width: view.getUint16(6, true), height: view.getUint16(8, true) };
  if (ascii(bytes, 0, 2) === 'BM') return bmpSize(view);
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return webpSize(bytes, view);
  if (ascii(bytes, 0, 4) === '8BPS') return { width: view.getUint32(18), height: view.getUint32(14) };
  if (startsWith(bytes, [0x76, 0x2f, 0x31, 0x01])) return exrSize(bytes, view);
  if (ascii(bytes, 0, 2) === '#?') return radianceSize(bytes);
  if (ascii(bytes, 0, 2) === 'II' || ascii(bytes, 0, 2) === 'MM') return tiffSize(bytes, view);
  // TGA has no signature: its header, by the name.
  if (textureFormatOf(fileName) === 'tga' && bytes.length >= 18) return { width: view.getUint16(12, true), height: view.getUint16(14, true) };
  return null;
}

/** The first frame header (SOF0-SOF15, but DHT, JPG and DAC) after the markers before it. */
function jpegSize(bytes: Uint8Array, view: DataView): ImageSize | null {
  for (let at = 2; at + 9 < bytes.length; ) {
    if (bytes[at] !== 0xff) return null;
    const marker = bytes[at + 1]!;
    if (marker === 0xff) {
      at++;
      continue;
    }
    // Markers without a length: the restarts, the start and end of image, TEM.
    if ((marker >= 0xd0 && marker <= 0xd9) || marker === 0x01) {
      at += 2;
      continue;
    }
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return { height: view.getUint16(at + 5), width: view.getUint16(at + 7) };
    at += 2 + view.getUint16(at + 2);
  }
  return null;
}

function bmpSize(view: DataView): ImageSize {
  // An OS/2 header is 12 bytes, its sizes 16-bit; any later one's are 32-bit, the height negative when stored top-down.
  if (view.getUint32(14, true) === 12) return { width: view.getUint16(18, true), height: view.getUint16(20, true) };
  return { width: Math.abs(view.getInt32(18, true)), height: Math.abs(view.getInt32(22, true)) };
}

function webpSize(bytes: Uint8Array, view: DataView): ImageSize | null {
  switch (ascii(bytes, 12, 4)) {
    case 'VP8 ':
      return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
    case 'VP8L': {
      const bits = view.getUint32(21, true);
      return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
    }
    case 'VP8X':
      return { width: 1 + (view.getUint32(24, true) & 0xffffff), height: 1 + (view.getUint32(27, true) & 0xffffff) };
    default:
      return null;
  }
}

/** OpenEXR's header: attributes (name, type, size, value) until an empty name; the size is its `dataWindow`'s box. */
function exrSize(bytes: Uint8Array, view: DataView): ImageSize | null {
  for (let at = 8; at < bytes.length; ) {
    const name = cString(bytes, at);
    if (name === '') return null;
    at += name.length + 1;
    const type = cString(bytes, at);
    at += type.length + 1;
    const size = view.getUint32(at, true);
    at += 4;
    if (name === 'dataWindow' && type === 'box2i') {
      const [xMin, yMin, xMax, yMax] = [0, 4, 8, 12].map((offset) => view.getInt32(at + offset, true)) as [number, number, number, number];
      return { width: xMax - xMin + 1, height: yMax - yMin + 1 };
    }
    at += size;
  }
  return null;
}

/** Radiance's text header ends at an empty line; the next line is the resolution, `-Y 512 +X 1024`. */
function radianceSize(bytes: Uint8Array): ImageSize | null {
  const header = new TextDecoder('latin1').decode(bytes.subarray(0, Math.min(bytes.length, 4096)));
  const match = /\n\s*\n([-+])Y\s+(\d+)\s+([-+])X\s+(\d+)/.exec(header);
  return match ? { width: Number(match[4]), height: Number(match[2]) } : null;
}

/** The first image's ImageWidth (256) and ImageLength (257) tags. */
function tiffSize(bytes: Uint8Array, view: DataView): ImageSize | null {
  const little = ascii(bytes, 0, 2) === 'II';
  const directory = view.getUint32(4, little);
  const count = view.getUint16(directory, little);
  const size: Partial<ImageSize> = {};
  for (let entry = 0; entry < count; entry++) {
    const at = directory + 2 + entry * 12;
    const tag = view.getUint16(at, little);
    const type = view.getUint16(at + 2, little);
    const value = type === 3 ? view.getUint16(at + 8, little) : view.getUint32(at + 8, little);
    if (tag === 256) size.width = value;
    if (tag === 257) size.height = value;
  }
  return size.width !== undefined && size.height !== undefined ? { width: size.width, height: size.height } : null;
}

function startsWith(bytes: Uint8Array, prefix: number[]): boolean {
  return prefix.every((value, i) => bytes[i] === value);
}

function ascii(bytes: Uint8Array, at: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(at, at + length));
}

function cString(bytes: Uint8Array, at: number): string {
  const end = bytes.indexOf(0, at);
  return end === -1 ? '' : ascii(bytes, at, end - at);
}
