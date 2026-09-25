import type { OperationProgress, ProgressStage } from '@shared/domain/operation';
import { formatRemaining, nextBarMotion, REACH_MS, remainingMs, type BarMotion } from './progressMotion';

/**
 * What the progress bar draws: `sweep` while nothing tells how far along it is, `fill` up to `value` (gliding for
 * `durationMs`), and `busy`, full and shimmering, once the measured part is done and it's wrapping up (confirming a
 * checkin).
 */
export interface ProgressBarState {
  mode: 'sweep' | 'fill' | 'busy';
  value: number;
  durationMs: number;
  /** "About 25 s left", only when the pace is steady enough to tell. */
  remaining: string | null;
  motion: BarMotion | null;
}

/** Stages after the measured work: the bar stays full, shimmering. Any other unmeasured stage sweeps. */
const WRAPPING_UP = new Set<ProgressStage>(['confirming', 'finishing']);

/** Below this the bar keeps sweeping. */
const VISIBLE_FROM = 0.01;

export const SWEEP: ProgressBarState = { mode: 'sweep', value: 0, durationMs: 0, remaining: null, motion: null };

/** How full a progress ring shows the bar: null spins it. */
export function ringValue(bar: ProgressBarState): number | null {
  if (bar.mode === 'sweep') return null;
  return bar.mode === 'busy' ? 1 : bar.value;
}

/** The bar after a report. Each step of an operation measures its own stretch of work. */
export function nextProgressBar(previous: ProgressBarState, progress: OperationProgress, now: number): ProgressBarState {
  const key = String(progress.step?.index ?? 0);
  if (progress.fraction !== null) {
    const paced = nextBarMotion(previous.motion, key, progress.fraction, now);
    // Hardly anything done yet (a checkin reports again only 5 s after it starts uploading): a nearly empty bar would
    // look stuck. The sweep goes on, and the report is kept to pace the bar from the next one on.
    if (progress.fraction < VISIBLE_FROM) return { ...SWEEP, motion: paced };
    // Out of the sweep, the bar first catches up with what's done.
    const motion = previous.mode === 'sweep' ? { ...paced, from: 0, to: progress.fraction, durationMs: REACH_MS } : paced;
    const remaining = remainingMs(motion);
    return { mode: 'fill', value: motion.to, durationMs: motion.durationMs, remaining: remaining === null ? null : formatRemaining(remaining), motion };
  }
  if (WRAPPING_UP.has(progress.stage) && previous.motion?.key === key) return { mode: 'busy', value: 1, durationMs: REACH_MS, remaining: null, motion: previous.motion };
  return { ...SWEEP, motion: previous.motion };
}
