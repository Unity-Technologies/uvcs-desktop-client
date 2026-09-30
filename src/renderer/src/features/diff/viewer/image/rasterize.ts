// Rasterize a decoded image (SVG included) into a tightly packed RGBA bitmap.
// Cached per decoded element: the differences mode and the pixel inspector
// both sample pixels, and a multi-megapixel getImageData is the kind of
// main-thread hit that should happen at most once per revision. The WeakMap
// releases the bytes as soon as the decoded image itself is dropped.

import type { RgbaBitmap } from './pixelComparison';
import type { DecodedImage } from './useDecodedImage';

const cache = new WeakMap<HTMLImageElement, RgbaBitmap>();

export function rasterize(image: DecodedImage): RgbaBitmap {
  const hit = cache.get(image.element);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return {
      data: new Uint8ClampedArray(image.width * image.height * 4),
      width: image.width,
      height: image.height,
    };
  }
  ctx.drawImage(image.element, 0, 0, image.width, image.height);
  const data = ctx.getImageData(0, 0, image.width, image.height);
  const bitmap = { data: data.data, width: data.width, height: data.height };
  cache.set(image.element, bitmap);
  return bitmap;
}
