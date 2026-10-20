// An image the browser can't decode (TGA, TIFF, OpenEXR, Radiance HDR, Photoshop: `needsDecoding`) made into one it
// paints, in the image decoding worker (`paintOffThread`): its format told by its content, else by its type; its size read from its header
// and refused past what is decoded (`sizeProblem`) before anything decodes it; its pixels decoded (`decodePixels`) and
// written as a BMP (`bmpOf`), which every image mode, the pixel inspector and the merge page's previews then paint as
// they paint a PNG. A high dynamic range image shows as the model diff's textures do: clamped to 0-1, as sRGB.

import type { ImageBytes } from '@shared/domain/content';
import { bmpOf } from '../../../../lib/images/bmpImage';
import { decodePixels } from '../../../../lib/images/decodePixels';
import { imageFormatOfContent, imageSizeOf, sizeProblem } from '../../../../lib/images/imageFormats';
import type { ImageProblem } from '../../../../lib/images/imageProblems';
import { decodedFormatOf } from './decodedImageTypes';
import { imageBlob } from './imageBlob';

export type PaintableImage =
  /** `highDynamicRange`: what shows is the image clamped to 0-1, not the values the file holds. */
  // A Blob, which crosses back from the worker as a handle: the page never holds the pixels' bytes, only their URL.
  | { status: 'paintable'; blob: Blob; highDynamicRange: boolean }
  | { status: 'failed'; problem: ImageProblem };

export function paintableImage(image: ImageBytes): PaintableImage {
  const format = imageFormatOfContent(image.bytes) ?? decodedFormatOf(image.mimeType);
  // A file named as a texture that holds a PNG or a JPEG: the browser reads an image by its signature, not its type.
  if (format === 'browser') return { status: 'paintable', blob: imageBlob(image), highDynamicRange: false };
  if (format === null || format === 'unsupported') return failed('unsupportedFormat');
  const size = imageSizeOf(image.bytes, format);
  if (!size) return failed('unreadable');
  const tooLarge = sizeProblem(size);
  if (tooLarge) return failed(tooLarge);
  const pixels = decodePixels(image.bytes, format);
  if (pixels.kind === 'failed') return failed(pixels.problem);
  const bmp = { bytes: bmpOf(pixels), mimeType: 'image/bmp' };
  return { status: 'paintable', blob: imageBlob(bmp), highDynamicRange: format === 'exr' || format === 'hdr' };
}

function failed(problem: ImageProblem): PaintableImage {
  return { status: 'failed', problem };
}
