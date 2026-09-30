import type { RgbaBitmap } from './pixelComparison';

/** A bitmap of RGBA pixels, row by row, for tests. */
export function bitmap(width: number, height: number, pixels: number[][]): RgbaBitmap {
  const data = new Uint8ClampedArray(width * height * 4);
  pixels.forEach((pixel, index) => data.set(pixel, index * 4));
  return { data, width, height };
}

export function opaque(red: number, green: number, blue: number): number[] {
  return [red, green, blue, 255];
}

/** Pixel (x, y) of RGBA bytes `width` pixels wide. */
export function pixelOf(data: Uint8ClampedArray, width: number, x: number, y: number): number[] {
  const at = (y * width + x) * 4;
  return [data[at]!, data[at + 1]!, data[at + 2]!, data[at + 3]!];
}
