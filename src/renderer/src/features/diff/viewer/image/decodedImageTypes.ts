// Which images the browser can't paint from their bytes and the app decodes first (`paintableImage`, in the texture
// worker): the types main gives Unity's texture formats (`DECODED_IMAGE_TYPES`). Light on purpose: what shows
// an image asks this on the page's thread, and the decoders (three's loaders) load only in the worker.

import { DECODED_IMAGE_TYPES, type ImageBytes } from '@shared/domain/content';
import type { PixelFormat } from '../../../../lib/images/decodePixels';
import { imageFormatOfContent } from '../../../../lib/images/imageFormats';

/** Every format the app decodes has its type: a format added to `decodePixels` without one fails to compile here. */
const TYPE_OF_FORMAT: Readonly<Record<PixelFormat, string>> = DECODED_IMAGE_TYPES;
const FORMAT_OF_TYPE = new Map((Object.keys(TYPE_OF_FORMAT) as PixelFormat[]).map((format) => [TYPE_OF_FORMAT[format], format]));

/** The format an image of this type decodes as; null for the types the browser paints itself. */
export function decodedFormatOf(mimeType: string): PixelFormat | null {
  return FORMAT_OF_TYPE.get(mimeType) ?? null;
}

/**
 * Whether the image goes to the worker before it paints: a texture format, unless its bytes are one the browser reads
 * (a PNG saved as `.tga`), told here at once by its signature, with no trip to the worker.
 */
export function needsDecoding(image: ImageBytes): boolean {
  return decodedFormatOf(image.mimeType) !== null && imageFormatOfContent(image.bytes) !== 'browser';
}
