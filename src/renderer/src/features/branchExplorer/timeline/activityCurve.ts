import { stripXOfColumn, type TimelineAxis } from './timelineAxis';
import type { TimelineHistory, TimelineShare } from './timelineHistory';
import { countBetween } from './sortedSearch';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/**
 * How far around a changeset the activity counts, by how long a history is loaded: ±1 h for a week, ±12 h for about
 * three months, ±3.5 days for a year. Between them it grows smoothly (along a straight line in log-log), and past them
 * with the range, so the curve keeps the same grain however much is loaded.
 */
const WINDOW_ANCHORS: readonly (readonly [range: number, halfWindow: number])[] = [
  [7 * DAY, HOUR],
  [91 * DAY, 12 * HOUR],
  [365 * DAY, 3.5 * DAY],
];

/** The curve is blurred by a Gaussian this wide (its σ, in px), so it reads as a landscape rather than a bar chart. */
export const BLUR_SIGMA = 3;
/** The curve's top is this percentile of its heights: a single burst doesn't flatten everything else. */
const SCALE_PERCENTILE = 0.98;
/** The user's share is never thinner than this (px) where they have a changeset: 1 in 1,000 still shows. */
export const SHARE_MIN_HEIGHT = 2.5;

export function activityHalfWindow(range: number): number {
  const [first, ...rest] = WINDOW_ANCHORS;
  if (range <= first![0]) return (first![1] * Math.max(range, HOUR)) / first![0];
  let previous = first!;
  for (const anchor of rest) {
    if (range <= anchor[0]) {
      const t = Math.log(range / previous[0]) / Math.log(anchor[0] / previous[0]);
      return Math.exp(Math.log(previous[1]) + t * Math.log(anchor[1] / previous[1]));
    }
    previous = anchor;
  }
  return (previous[1] * range) / previous[0];
}

/** For each column, how many of the ascending `times` lie within `halfWindow` of its time. */
export function columnActivity(columnTimes: Float64Array, times: Float64Array, halfWindow: number): Float64Array {
  const activity = new Float64Array(columnTimes.length);
  for (let column = 0; column < columnTimes.length; column++) {
    const time = columnTimes[column]!;
    activity[column] = countBetween(times, time - halfWindow, time + halfWindow);
  }
  return activity;
}

/**
 * The columns' values as one per pixel of the strip: the mean of the columns in each pixel, and between pixels with
 * none (a short history, wider than the strip) a straight line from one to the next. Outside the history, nothing.
 */
export function perPixelMean(columnValues: Float64Array, axis: TimelineAxis): Float64Array {
  const width = Math.max(0, Math.ceil(axis.width));
  const sums = new Float64Array(width);
  const counts = new Uint32Array(width);
  for (let column = 0; column < columnValues.length; column++) {
    const pixel = Math.floor(stripXOfColumn(axis, column));
    if (pixel < 0 || pixel >= width) continue;
    sums[pixel]! += columnValues[column]!;
    counts[pixel]!++;
  }
  const values = new Float64Array(width);
  let previous = -1;
  for (let pixel = 0; pixel < width; pixel++) {
    if (counts[pixel] === 0) continue;
    values[pixel] = sums[pixel]! / counts[pixel]!;
    if (previous >= 0) for (let between = previous + 1; between < pixel; between++) values[between] = values[previous]! + ((values[pixel]! - values[previous]!) * (between - previous)) / (pixel - previous);
    previous = pixel;
  }
  return values;
}

/** A Gaussian blur of σ `sigma` px; near the ends only what is inside counts (no fading into a zero outside). */
export function gaussianBlur(values: Float64Array, sigma: number): Float64Array {
  const radius = Math.ceil(sigma * 3);
  const kernel = Array.from({ length: radius * 2 + 1 }, (_, index) => Math.exp(-((index - radius) ** 2) / (2 * sigma * sigma)));
  const blurred = new Float64Array(values.length);
  for (let pixel = 0; pixel < values.length; pixel++) {
    let sum = 0;
    let weight = 0;
    for (let offset = -radius; offset <= radius; offset++) {
      const at = pixel + offset;
      if (at < 0 || at >= values.length) continue;
      const k = kernel[offset + radius]!;
      sum += values[at]! * k;
      weight += k;
    }
    blurred[pixel] = sum / weight;
  }
  return blurred;
}

/** The `p` percentile (0 to 1) of the values above zero; zero when there are none. */
export function percentile(values: Float64Array, p: number): number {
  const positive = values.filter((value) => value > 0).sort();
  if (positive.length === 0) return 0;
  return positive[Math.min(positive.length - 1, Math.floor(p * (positive.length - 1)))]!;
}

/** The Timeline's curve, one height (0 to 1 of the plot) per pixel of the strip. */
export interface ActivityCurve {
  total: Float64Array;
  /** The user's share of it, in the same scale, under it. */
  share: Float64Array;
  /** 1 where a pixel holds one of the user's changesets. */
  sharePresent: Uint8Array;
}

/**
 * The smooth activity across the strip: each column's count of changesets within a window of its time
 * (`activityHalfWindow`), a mean per pixel, a Gaussian blur, scaled to the 98th percentile. A count per day drawn over
 * the day's columns was tried and dropped: flat mesas with cliffs between them. Computed once per layout, share and
 * width, never per frame.
 */
export function activityCurve(history: TimelineHistory, share: TimelineShare, axis: TimelineAxis): ActivityCurve {
  const halfWindow = activityHalfWindow(history.end - history.start);
  const total = gaussianBlur(perPixelMean(columnActivity(history.columnTimes, history.times, halfWindow), axis), BLUR_SIGMA);
  const theirs = gaussianBlur(perPixelMean(columnActivity(history.columnTimes, share.times, halfWindow), axis), BLUR_SIGMA);
  const top = percentile(total, SCALE_PERCENTILE) || 1;
  const sharePresent = new Uint8Array(total.length);
  for (let column = 0; column < share.columns.length; column++) {
    const pixel = Math.floor(stripXOfColumn(axis, column));
    if (share.columns[column] && pixel >= 0 && pixel < sharePresent.length) sharePresent[pixel] = 1;
  }
  return {
    total: total.map((value) => Math.min(1, value / top)),
    share: theirs.map((value) => Math.min(1, value / top)),
    sharePresent,
  };
}

/** How tall the user's share stands at a pixel, in px of a plot `plotHeight` tall: never thinner than the minimum where they have a changeset. */
export function shareHeight(curve: ActivityCurve, pixel: number, plotHeight: number): number {
  const height = curve.share[pixel]! * plotHeight;
  return curve.sharePresent[pixel] ? Math.max(SHARE_MIN_HEIGHT, height) : height;
}
