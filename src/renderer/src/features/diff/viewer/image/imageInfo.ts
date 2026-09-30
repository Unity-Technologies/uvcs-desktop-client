import { formatSize } from '../../../../lib/formatDate';
import type { Size } from './composedFrame';

/** How much of a pair differs at the tolerance, which the Differences mode counts for the info strip. */
export interface DiffStats {
  changedPixels: number;
  coveredPixels: number;
}

/** A pixel's red, green, blue and alpha, 0–255 each. */
export type Rgba = readonly [number, number, number, number];

/** "1024×768 · 245 KB": one revision's identity card for the info strip. */
export function sideLabel(image: Size, bytes: number): string {
  return `${image.width}×${image.height} · ${formatSize(bytes)}`;
}

/**
 * The % readout must stay honest: with a tolerance applied, zero changes means
 * "nothing above the tolerance", not "pixel-identical".
 */
export function changedLabel({ changedPixels, coveredPixels }: DiffStats, tolerance: number): string | null {
  if (coveredPixels === 0) return null;
  if (changedPixels === 0) return tolerance > 0 ? 'no changes above tolerance' : 'pixel-identical';
  const percent = (changedPixels / coveredPixels) * 100;
  return `${percent < 0.1 ? '< 0.1' : percent.toFixed(1)}% of pixels differ`;
}

/** The pixel inspector's color: #RRGGBB, with /AA only when the pixel isn't fully opaque. */
export function colorHex([red, green, blue, alpha]: Rgba): string {
  const hex = (value: number): string => value.toString(16).padStart(2, '0');
  return `#${hex(red)}${hex(green)}${hex(blue)}${alpha !== 255 ? `/${hex(alpha)}` : ''}`;
}
