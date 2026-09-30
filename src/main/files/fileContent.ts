import { extname } from 'node:path';
import type { FileContent, ImageBytes } from '@shared/domain/content';

/** Past this, a text diff is too slow to compute and too long to read. */
export const MAX_TEXT_BYTES = 10 * 1024 * 1024;
/**
 * Hard cap per image side. Images cross the IPC boundary as their bytes, so this bounds the
 * renderer payload at 40 MB a side: large enough for any reviewable asset, small enough to
 * never stall the bridge.
 */
export const MAX_IMAGE_BYTES = 40 * 1024 * 1024;
const BINARY_SNIFF_BYTES = 8000;

const IMAGE_MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};
/**
 * Images written as text: shown both as a text diff and rendered (the renderer only ever paints them through `<img>`,
 * where scripts don't run and nothing outside the file loads).
 */
const TEXT_IMAGE_MIME_TYPES: Record<string, string> = {
  '.svg': 'image/svg+xml',
};

export const EMPTY_CONTENT: FileContent = { text: '', isBinary: false, size: 0 };

/** Classifies raw bytes as text, image or opaque binary. `fileName` is used to recognize images. */
export function toFileContent(bytes: Buffer, fileName: string): FileContent {
  // A 0-byte file is empty whatever its extension; as an image it would not even decode.
  if (bytes.length === 0) return EMPTY_CONTENT;

  const extension = extname(fileName).toLowerCase();
  const imageMimeType = IMAGE_MIME_TYPES[extension];
  if (imageMimeType) {
    if (bytes.length > MAX_IMAGE_BYTES) return { isBinary: true, size: bytes.length, tooLarge: 'image' };
    return { isBinary: true, size: bytes.length, image: imageBytes(bytes, imageMimeType) };
  }

  const textImageMimeType = TEXT_IMAGE_MIME_TYPES[extension];
  if (textImageMimeType) return toTextImageContent(bytes, textImageMimeType);

  if (looksBinary(bytes)) return { isBinary: true, size: bytes.length };
  if (bytes.length > MAX_TEXT_BYTES) return { isBinary: true, size: bytes.length, tooLarge: 'text' };
  return { isBinary: false, size: bytes.length, text: bytes.toString('utf8') };
}

/** Text and image while the text is small enough to diff; past that (or not text, e.g. UTF-16), an image only. */
function toTextImageContent(bytes: Buffer, mimeType: string): FileContent {
  if (bytes.length > MAX_IMAGE_BYTES) return { isBinary: true, size: bytes.length, tooLarge: 'image' };
  const image = imageBytes(bytes, mimeType);
  if (looksBinary(bytes) || bytes.length > MAX_TEXT_BYTES) return { isBinary: true, size: bytes.length, image };
  return { isBinary: false, size: bytes.length, text: bytes.toString('utf8'), image };
}

/** The bytes as a plain `Uint8Array`: IPC copies them as binary (a `Buffer` would arrive as one too, pool slice and all). */
function imageBytes(bytes: Buffer, mimeType: string): ImageBytes {
  return { bytes: new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength), mimeType };
}

/** A NUL byte near the start, as Git tells binary files: text in UTF-8 or a single-byte code page has none. */
function looksBinary(bytes: Buffer): boolean {
  return bytes.subarray(0, BINARY_SNIFF_BYTES).includes(0);
}
