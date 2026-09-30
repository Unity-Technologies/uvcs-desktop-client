// The Differences mode's pixel passes: a perceptual comparison of two revisions, then a heatmap of it at a tolerance.
// Pure, on plain byte arrays, so they are tested without a canvas and run in the worker (`imageDiff.worker`).

import { anchoredOffset, composedSize, type AnchorMode } from './composedFrame';

/** A decoded RGBA bitmap: tightly packed rows (4 bytes a pixel). On a plain ArrayBuffer, to feed `new ImageData()`. */
export interface RgbaBitmap {
  data: Uint8ClampedArray<ArrayBuffer>;
  width: number;
  height: number;
}

/**
 * Two revisions compared, in the composed frame. Nothing here depends on the tolerance, so moving the slider only
 * renders the heatmap again (`renderHeatmap`) and counts from the histogram, never compares pixels again.
 */
export interface PixelComparison {
  width: number;
  height: number;
  /** Each pixel's perceptual difference, 0–255: 255 where one revision covers it alone, 0 where neither does. */
  difference: Uint8Array;
  /** The ghost backdrop: the new revision dimmed to gray (the old one where only it covers), clear where neither does. */
  ghost: Uint8ClampedArray<ArrayBuffer>;
  /** `histogram[d]`: the covered pixels whose difference is exactly d. On a plain ArrayBuffer, to transfer it. */
  histogram: Uint32Array<ArrayBuffer>;
  /** Pixels at least one revision covers: what a share of changed pixels is of. */
  coveredPixels: number;
}

/** The tolerance slider's range. 64 silences even heavy JPEG and anti-aliasing noise; one-sided pixels (255) stay above it. */
export const MAX_TOLERANCE = 64;

/** The heatmap's color (magenta): outside the red-before, green-after vocabulary, so "changed" reads apart, in both themes. */
export const HEATMAP_ACCENT: readonly [number, number, number] = [236, 64, 142];

/** The ghost's opacity: enough to see where in the picture a change is, dim enough that the accent draws the eye. */
const GHOST_ALPHA = 90;

/** A changed pixel's opacity starts here, so one barely over the tolerance still shows. */
const MIN_ACCENT_ALPHA = 140;

/**
 * Compares two bitmaps as the eye sees them: a pixel's difference is the largest channel difference with both sides
 * composited on white, or their alpha difference if larger. So a color change under full transparency scores 0, an
 * alpha-only change still counts, and the score grows with what changed (127→128 is 1, 0→128 is 128).
 */
export function comparePixels(old: RgbaBitmap, next: RgbaBitmap, anchor: AnchorMode): PixelComparison {
  const frame = composedSize(old, next);
  const pixelCount = frame.width * frame.height;
  const difference = new Uint8Array(pixelCount);
  const ghost = new Uint8ClampedArray(pixelCount * 4);
  const histogram = new Uint32Array(256);
  const oldOffset = anchoredOffset(frame, old, anchor);
  const newOffset = anchoredOffset(frame, next, anchor);
  let coveredPixels = 0;

  for (let y = 0; y < frame.height; y++) {
    const oldY = y - oldOffset.y;
    const newY = y - newOffset.y;
    const rowInOld = oldY >= 0 && oldY < old.height;
    const rowInNew = newY >= 0 && newY < next.height;
    if (!rowInOld && !rowInNew) continue;
    for (let x = 0; x < frame.width; x++) {
      const oldX = x - oldOffset.x;
      const newX = x - newOffset.x;
      const inOld = rowInOld && oldX >= 0 && oldX < old.width;
      const inNew = rowInNew && newX >= 0 && newX < next.width;
      if (!inOld && !inNew) continue;
      coveredPixels++;
      const oldIndex = (oldY * old.width + oldX) * 4;
      const newIndex = (newY * next.width + newX) * 4;
      // A pixel only one revision covers was added or removed outright: the largest change there is.
      const pixelDifference = inOld && inNew ? perceptualDifference(old.data, oldIndex, next.data, newIndex) : 255;
      const pixel = y * frame.width + x;
      difference[pixel] = pixelDifference;
      histogram[pixelDifference]++;
      const gray = inNew ? grayOnWhite(next.data, newIndex) : grayOnWhite(old.data, oldIndex);
      const ghostAt = pixel * 4;
      ghost[ghostAt] = gray;
      ghost[ghostAt + 1] = gray;
      ghost[ghostAt + 2] = gray;
      ghost[ghostAt + 3] = GHOST_ALPHA;
    }
  }
  return { width: frame.width, height: frame.height, difference, ghost, histogram, coveredPixels };
}

/** Covered pixels whose difference is above the tolerance, from the histogram alone (so the slider can ask every frame). */
export function countChangedPixels(histogram: Uint32Array, tolerance: number): number {
  let count = 0;
  for (let d = tolerance + 1; d < 256; d++) count += histogram[d]!;
  return count;
}

/**
 * The heatmap at a tolerance: the ghost where a pixel changed no more than it, the accent where it changed more, as
 * opaque as the change is large (faint drift renders faint, a real change solid).
 */
export function renderHeatmap(comparison: PixelComparison, tolerance: number): Uint8ClampedArray<ArrayBuffer> {
  const { difference, ghost } = comparison;
  const heatmap = new Uint8ClampedArray(ghost.length);
  for (let pixel = 0; pixel < difference.length; pixel++) {
    const at = pixel * 4;
    const pixelDifference = difference[pixel]!;
    if (pixelDifference > tolerance) {
      heatmap[at] = HEATMAP_ACCENT[0];
      heatmap[at + 1] = HEATMAP_ACCENT[1];
      heatmap[at + 2] = HEATMAP_ACCENT[2];
      heatmap[at + 3] = MIN_ACCENT_ALPHA + Math.floor((pixelDifference * (255 - MIN_ACCENT_ALPHA)) / 255);
    } else {
      heatmap[at] = ghost[at]!;
      heatmap[at + 1] = ghost[at + 1]!;
      heatmap[at + 2] = ghost[at + 2]!;
      heatmap[at + 3] = ghost[at + 3]!;
    }
  }
  return heatmap;
}

function perceptualDifference(old: Uint8ClampedArray, oldIndex: number, next: Uint8ClampedArray, newIndex: number): number {
  const oldAlpha = old[oldIndex + 3]!;
  const newAlpha = next[newIndex + 3]!;
  let largest = Math.abs(oldAlpha - newAlpha);
  for (let channel = 0; channel < 3; channel++) {
    const channelDifference = Math.abs(onWhite(old[oldIndex + channel]!, oldAlpha) - onWhite(next[newIndex + channel]!, newAlpha));
    if (channelDifference > largest) largest = channelDifference;
  }
  return largest;
}

/** The pixel's Rec. 601 luma, composited on white. */
function grayOnWhite(data: Uint8ClampedArray, index: number): number {
  const alpha = data[index + 3]!;
  return Math.round(0.299 * onWhite(data[index]!, alpha) + 0.587 * onWhite(data[index + 1]!, alpha) + 0.114 * onWhite(data[index + 2]!, alpha));
}

/** A channel composited on white by its alpha: differences are measured on what the eye sees (pixelmatch's convention). */
function onWhite(channel: number, alpha: number): number {
  return Math.round(255 + ((channel - 255) * alpha) / 255);
}
