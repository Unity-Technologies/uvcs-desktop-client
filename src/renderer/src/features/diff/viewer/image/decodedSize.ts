import type { Size } from './composedFrame';

/** SVGs without width/height decode as 0×0; give them a sane canvas. */
const FALLBACK_SIZE = { width: 300, height: 150 };
/**
 * Most pixels a vector image is drawn with. An SVG can declare any size (`width="100000"`) at no cost in bytes, and
 * every mode rasterizes it at that size: past this it is drawn smaller, keeping its proportions. Vectors stay sharp.
 */
export const MAX_VECTOR_PIXELS = 4096 * 4096;

/** The size an image is laid out and rasterized at: its own, within `MAX_VECTOR_PIXELS` for vectors. */
export function decodedSize(natural: Size, vector: boolean): Size {
  const width = natural.width || FALLBACK_SIZE.width;
  const height = natural.height || FALLBACK_SIZE.height;
  const scale = vector ? Math.min(1, Math.sqrt(MAX_VECTOR_PIXELS / (width * height))) : 1;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
