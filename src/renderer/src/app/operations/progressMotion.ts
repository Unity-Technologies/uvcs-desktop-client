/** A reported fraction and when it came. */
export interface ProgressSample {
  at: number;
  fraction: number;
}

/**
 * Where the progress bar is heading and how long it takes to get there (a linear CSS transition), so it glides between
 * reports instead of jumping: `cm` reports every 200 ms while updating, but only every 5 s while checking in.
 */
export interface BarMotion {
  /** The stretch of work the bar measures (a step of the operation): a new one starts the bar over. */
  key: string;
  from: number;
  to: number;
  startedAt: number;
  durationMs: number;
  /** The first and the latest report of the stretch, for the pace. */
  first: ProgressSample;
  last: ProgressSample;
}

/** How long the bar takes to reach a report it can't pace: the first one, or the end. */
export const REACH_MS = 400;
/** The bar may run ahead of the last report by at most this share of what's left, in case the pace drops. */
const MAX_LEAD = 0.5;

export function barPosition(motion: BarMotion, now: number): number {
  const progress = motion.durationMs > 0 ? Math.min(1, Math.max(0, (now - motion.startedAt) / motion.durationMs)) : 1;
  return motion.from + (motion.to - motion.from) * progress;
}

/**
 * The next motion after a report: from where the bar is now towards where the next report should land at the current
 * pace, arriving when it's due. Never backwards within a stretch.
 */
export function nextBarMotion(previous: BarMotion | null, key: string, fraction: number, now: number): BarMotion {
  const sample = { at: now, fraction };
  if (!previous || previous.key !== key) {
    return { key, from: 0, to: fraction, startedAt: now, durationMs: REACH_MS, first: sample, last: sample };
  }

  const shown = barPosition(previous, now);
  const interval = now - previous.last.at;
  if (fraction >= 1 || interval <= 0) {
    return { ...previous, from: shown, to: Math.max(shown, fraction), startedAt: now, durationMs: REACH_MS, last: sample };
  }
  const pace = Math.max(0, fraction - previous.last.fraction) / interval;
  const expected = Math.min(fraction + pace * interval, fraction + (1 - fraction) * MAX_LEAD);
  return { ...previous, from: shown, to: Math.max(shown, fraction, expected), startedAt: now, durationMs: interval, last: sample };
}

/** Time left at the pace since the stretch started, only once that pace means something; null otherwise. */
export function remainingMs(motion: BarMotion): number | null {
  const { first, last } = motion;
  const elapsed = last.at - first.at;
  if (elapsed < 3000 || last.fraction < 0.05 || last.fraction > 0.97) return null;
  const pace = (last.fraction - first.fraction) / elapsed;
  if (pace <= 0) return null;
  const remaining = (1 - last.fraction) / pace;
  return remaining >= 3000 ? remaining : null;
}

/** "About 25 s left", "About 3 min left": coarse steps, so it doesn't flicker. */
export function formatRemaining(ms: number): string {
  const seconds = ms / 1000;
  if (seconds < 55) return `About ${Math.max(5, Math.ceil(seconds / 5) * 5)} s left`;
  return `About ${Math.max(1, Math.round(seconds / 60))} min left`;
}
