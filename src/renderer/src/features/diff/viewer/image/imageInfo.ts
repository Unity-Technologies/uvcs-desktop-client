import { formatSize } from '../../../../lib/formatDate';
import { imageProblemWords, type ImageProblem } from '../../../../lib/images/imageProblems';
import type { Size } from './composedFrame';

/** How much of a pair differs at the tolerance, which the Differences mode counts for the info strip. */
export interface DiffStats {
  changedPixels: number;
  coveredPixels: number;
}

/** A pixel's red, green, blue and alpha, 0–255 each. */
export type Rgba = readonly [number, number, number, number];

/**
 * "1024×768 · 245 KB": one revision's identity card for the info strip. A high dynamic range image says it shows
 * clamped (`highDynamicRange`): what is brighter than white in the file shows as white.
 */
export function sideLabel(image: Size & { highDynamicRange?: boolean }, bytes: number): string {
  return `${image.width}×${image.height} · ${formatSize(bytes)}${image.highDynamicRange ? ' · HDR, clamped' : ''}`;
}

/**
 * What a pair the viewer can't paint shows in its place: the binary diff's sizes, and why in plain words
 * (`imageProblemWords`).
 */
export function undecodedDescription(oldBytes: number, newBytes: number, problem: ImageProblem): string {
  return `${formatSize(oldBytes)} → ${formatSize(newBytes)}. ${capitalized(imageProblemWords(problem))}.`;
}

/** Why a preview shows no image (the merge page's cards), for its tooltip; a damaged file, or none told, in general words. */
export function undecodedTip(problem: ImageProblem | undefined): string {
  return problem === undefined || problem === 'unreadable' ? "Couldn't display this image" : capitalized(imageProblemWords(problem));
}

function capitalized(words: string): string {
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
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
