// One texture file's bytes as an ImageBitmap ready for the GPU, in the texture worker: its size checked from its
// header first, decoded by the browser or by `decodePixels`, shrunk to the budget's side (`fittedSize`), turned upside
// down for the models whose UVs start at the image's bottom (FBX, OBJ, Unity's materials: three's `flipY`, which
// WebGL can't apply to a bitmap), its alpha kept apart from its color, and whether any pixel is see-through
// (`bitmapIsOpaque`). Never on the UI thread.

import { decodePixels } from './decodePixels';
import { fittedSize } from './textureBudget';
import { imageSizeOf, sizeProblem, textureFormatOf } from './textureFormats';
import { bitmapIsOpaque } from './textureOpacity';
import type { TextureProblem } from './textureProblems';

export interface TextureDecodeRequest {
  bytes: Uint8Array;
  /** The file's name, whose extension tells its format. */
  name: string;
  /** The longest side to draw it at (`textureSideFor`). */
  longest: number;
  /** Bottom row first, for UVs that start at the bottom (everything but glTF). */
  flipY: boolean;
}

export type TextureDecoded = { kind: 'decoded'; bitmap: ImageBitmap; opaque: boolean } | { kind: 'failed'; problem: TextureProblem };

export async function decodeTexture({ bytes, name, longest, flipY }: TextureDecodeRequest): Promise<TextureDecoded> {
  const format = textureFormatOf(name);
  if (format === 'unsupported') return { kind: 'failed', problem: 'unsupportedFormat' };
  const size = imageSizeOf(bytes, name);
  if (!size) return { kind: 'failed', problem: 'unreadable' };
  const tooLarge = sizeProblem(size);
  if (tooLarge) return { kind: 'failed', problem: tooLarge };
  let source: ImageBitmapSource;
  if (format === 'browser') source = new Blob([bytes as Uint8Array<ArrayBuffer>]);
  else {
    const pixels = decodePixels(bytes, format);
    if (pixels.kind === 'failed') return pixels;
    source = new ImageData(pixels.rgba as Uint8ClampedArray<ArrayBuffer>, pixels.width, pixels.height);
  }
  const target = fittedSize(size, longest);
  try {
    const bitmap = await createImageBitmap(source, {
      imageOrientation: flipY ? 'flipY' : 'from-image',
      premultiplyAlpha: 'none',
      colorSpaceConversion: 'none',
      resizeWidth: target.width,
      resizeHeight: target.height,
      resizeQuality: 'high',
    });
    return { kind: 'decoded', bitmap, opaque: bitmapIsOpaque(bitmap) };
  } catch {
    return { kind: 'failed', problem: 'unreadable' };
  }
}
