import { extname } from 'node:path';
import type { FileContent } from '@shared/domain/content';

const MAX_TEXT_BYTES = 10 * 1024 * 1024;
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
  const imageMimeType = IMAGE_MIME_TYPES[extname(fileName).toLowerCase()];
  if (imageMimeType) {
    return { isBinary: true, size: bytes.length, imageDataUrl: `data:${imageMimeType};base64,${bytes.toString('base64')}` };
  }

  if (bytes.length > MAX_TEXT_BYTES || looksBinary(bytes)) {
    return { isBinary: true, size: bytes.length };
  }

  return { isBinary: false, size: bytes.length, text: bytes.toString('utf8') };
}

function looksBinary(bytes: Buffer): boolean {
  return bytes.subarray(0, BINARY_SNIFF_BYTES).includes(0);
}
