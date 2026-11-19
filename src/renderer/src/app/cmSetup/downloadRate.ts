/**
 * Estimates the time a download has left from its progress, smoothed so the number doesn't jump with each chunk. It
 * says nothing for the first seconds (`SETTLING_MS`), while the rate is still finding its pace, and nothing without a
 * size to reach.
 */
export const SETTLING_MS = 2_000;

/** How much each new measure weighs against the rate so far. */
const SMOOTHING = 0.2;

export interface DownloadRate {
  startedAt: number;
  lastAt: number;
  lastBytes: number;
  /** Bytes per millisecond, smoothed; null before a second measure. */
  rate: number | null;
}

export function startRate(at: number, bytes: number): DownloadRate {
  return { startedAt: at, lastAt: at, lastBytes: bytes, rate: null };
}

/** The rate after one more measure; a measure that goes back (a download started over) starts it over. */
export function measureRate(previous: DownloadRate, at: number, bytes: number): DownloadRate {
  if (bytes < previous.lastBytes) return startRate(at, bytes);
  const elapsed = at - previous.lastAt;
  if (elapsed <= 0) return previous;
  const measured = (bytes - previous.lastBytes) / elapsed;
  const rate = previous.rate === null ? measured : previous.rate + SMOOTHING * (measured - previous.rate);
  return { ...previous, lastAt: at, lastBytes: bytes, rate };
}

/** Seconds left to reach `totalBytes`, or null while it can't be said yet. */
export function secondsLeft(rate: DownloadRate, totalBytes: number | null): number | null {
  if (totalBytes === null || rate.rate === null || rate.rate <= 0) return null;
  if (rate.lastAt - rate.startedAt < SETTLING_MS) return null;
  return Math.max(0, totalBytes - rate.lastBytes) / rate.rate / 1000;
}
