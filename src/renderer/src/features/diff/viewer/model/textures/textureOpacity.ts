// Whether a decoded texture has any see-through pixel, read once in the texture worker: a blended material over a
// texture without one is drawn opaque (`drawnAlpha`). What the image's alpha is, not what its format could hold: an
// RGBA PNG saved with every pixel opaque is opaque.

/** Whether every pixel of RGBA bytes has full alpha. */
export function everyPixelOpaque(rgba: Uint8ClampedArray): boolean {
  for (let alpha = 3; alpha < rgba.length; alpha += 4) if (rgba[alpha] !== 255) return false;
  return true;
}

/** The bitmap's pixels read back through a canvas of its size; not opaque where they can't be read. */
export function bitmapIsOpaque(bitmap: ImageBitmap): boolean {
  const context = new OffscreenCanvas(bitmap.width, bitmap.height).getContext('2d');
  if (!context) return false;
  context.drawImage(bitmap, 0, 0);
  return everyPixelOpaque(context.getImageData(0, 0, bitmap.width, bitmap.height).data);
}
