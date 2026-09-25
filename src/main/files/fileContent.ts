import { extname } from 'node:path';
import type { FileContent } from '@shared/domain/content';

/** Past this, a text diff is too slow to compute and too long to read. */
export const MAX_TEXT_BYTES = 10 * 1024 * 1024;
/**
 * Hard cap per image side. Images cross the IPC boundary base64-encoded (~1.37×), so this
 * bounds the renderer payload at ~55 MB worst case: large enough for any reviewable asset,
 * small enough to never stall the bridge.
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

export const EMPTY_CONTENT: FileContent = { text: '', isBinary: false, size: 0 };

/** Classifies raw bytes as text, image or opaque binary. `fileName` is used to recognize images. */
export function toFileContent(bytes: Buffer, fileName: string): FileContent {
  // A 0-byte file is empty whatever its extension; as an image it would not even decode.
  if (bytes.length === 0) return EMPTY_CONTENT;

  const imageMimeType = IMAGE_MIME_TYPES[extname(fileName).toLowerCase()];
  if (imageMimeType) {
    if (bytes.length > MAX_IMAGE_BYTES) return { isBinary: true, size: bytes.length, tooLarge: 'image' };
    return { isBinary: true, size: bytes.length, imageDataUrl: `data:${imageMimeType};base64,${bytes.toString('base64')}` };
  }

  if (looksBinary(bytes)) return { isBinary: true, size: bytes.length };
  if (bytes.length > MAX_TEXT_BYTES) return { isBinary: true, size: bytes.length, tooLarge: 'text' };
  return { isBinary: false, size: bytes.length, text: bytes.toString('utf8') };
}

function looksBinary(bytes: Buffer): boolean {
  return bytes.subarray(0, BINARY_SNIFF_BYTES).includes(0);
}
