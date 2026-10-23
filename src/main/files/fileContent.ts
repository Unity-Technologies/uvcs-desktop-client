import { extname } from 'node:path';
import { DECODED_IMAGE_TYPES, type FileContent, type ImageBytes, type ModelBytes, type ModelFormat } from '@shared/domain/content';

/** Past this, a text diff is too slow to compute and too long to read. */
export const MAX_TEXT_BYTES = 10 * 1024 * 1024;
/**
 * Hard cap per image side. Images cross the IPC boundary as their bytes, so this bounds the
 * renderer payload at 40 MB a side: large enough for any reviewable asset, small enough to
 * never stall the bridge.
 */
export const MAX_IMAGE_BYTES = 40 * 1024 * 1024;
/**
 * Hard cap per model side. A character with its animations runs 50-150 MB as FBX; past this, parsing and drawing both
 * versions would hold too much of the renderer's memory.
 */
export const MAX_MODEL_BYTES = 100 * 1024 * 1024;
/** How much of a file's start tells binary from text (`looksBinary`). */
export const BINARY_SNIFF_BYTES = 8000;

const IMAGE_MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  // Unity's texture formats, which the renderer decodes itself before painting them.
  '.tga': DECODED_IMAGE_TYPES.tga,
  '.tif': DECODED_IMAGE_TYPES.tiff,
  '.tiff': DECODED_IMAGE_TYPES.tiff,
  '.exr': DECODED_IMAGE_TYPES.exr,
  '.hdr': DECODED_IMAGE_TYPES.hdr,
  '.psd': DECODED_IMAGE_TYPES.psd,
  '.psb': DECODED_IMAGE_TYPES.psd,
};
/**
 * Images written as text: shown both as a text diff and rendered (the renderer only ever paints them through `<img>`,
 * where scripts don't run and nothing outside the file loads).
 */
const TEXT_IMAGE_MIME_TYPES: Record<string, string> = {
  '.svg': 'image/svg+xml',
};

/** OBJ and `.gltf` are always text, an FBX may be (ASCII FBX): those read as text too while they're small enough. */
const MODEL_FORMATS: Record<string, ModelFormat> = {
  '.fbx': 'fbx',
  '.obj': 'obj',
  '.gltf': 'gltf',
  '.glb': 'glb',
};

export const EMPTY_CONTENT: FileContent = { text: '', isBinary: false, size: 0 };
/** A revision whose content was purged (`isPurgedRevisionError`): an answer that never changes, not a failure. */
export const PURGED_CONTENT: FileContent = { isBinary: false, size: 0, purged: true };

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

  const modelFormat = MODEL_FORMATS[extension];
  if (modelFormat) return toModelContent(bytes, modelFormat);

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

/** A model, and its text while it is text small enough to diff (OBJ, `.gltf`, ASCII FBX). */
function toModelContent(bytes: Buffer, format: ModelFormat): FileContent {
  if (bytes.length > MAX_MODEL_BYTES) return { isBinary: true, size: bytes.length, tooLarge: 'model' };
  const model: ModelBytes = { bytes: plainBytes(bytes), format };
  if (looksBinary(bytes) || bytes.length > MAX_TEXT_BYTES) return { isBinary: true, size: bytes.length, model };
  return { isBinary: false, size: bytes.length, text: bytes.toString('utf8'), model };
}

function imageBytes(bytes: Buffer, mimeType: string): ImageBytes {
  return { bytes: plainBytes(bytes), mimeType };
}

/** The bytes as a plain `Uint8Array`: IPC copies them as binary (a `Buffer` would arrive as one too, pool slice and all). */
function plainBytes(bytes: Buffer): Uint8Array {
  return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

/**
 * A NUL byte near the start, as Git tells binary files: text in UTF-8 or a single-byte code page has none. UTF-16
 * text has them, so it reads as binary.
 */
export function looksBinary(bytes: Buffer): boolean {
  return bytes.subarray(0, BINARY_SNIFF_BYTES).includes(0);
}
