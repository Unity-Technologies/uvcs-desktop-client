/**
 * Inertia for dragging the graph with the mouse. Trackpad scrolling already coasts (the OS bakes
 * inertia into its wheel events), but a drag would stop dead on release. The release velocity is
 * estimated from the last pointer samples and then decays exponentially. The frame loop lives in panInertia.ts.
 */

/** A pointer position during a drag: screen px and ms. */
export interface PanSample {
  x: number;
  y: number;
  t: number;
}

/** Only this recent movement counts: pausing before letting go parks the graph. */
export const VELOCITY_WINDOW_MS = 100;
/** px/ms below which a release is a positioning drag, not a fling. */
export const FLING_MIN_LAUNCH = 0.25;
/** px/ms ceiling, so a violent flick glides fast but never teleports. */
export const FLING_MAX_SPEED = 9;
/** px/ms below which the glide has landed. */
export const FLING_MIN_SPEED = 0.01;
/** The decay time grows with the launch speed: a gentle push parks nearby, a hard throw sails. */
export const FLING_TAU_MIN_MS = 180;
export const FLING_TAU_MAX_MS = 800;
const FLING_TAU_PER_SPEED_MS = 75;

export interface Fling {
  vx: number;
  vy: number;
  tauMs: number;
}

export function flingTau(speed: number): number {
  return Math.min(FLING_TAU_MAX_MS, FLING_TAU_MIN_MS + FLING_TAU_PER_SPEED_MS * speed);
}

/** Adds a sample, dropping the ones older than the velocity window. */
export function pushPanSample(samples: PanSample[], sample: PanSample): void {
  samples.push(sample);
  while (samples.length > 0 && sample.t - samples[0]!.t > VELOCITY_WINDOW_MS) samples.shift();
}

/** The release velocity, or null when the release should not fling (parked pointer, slow drag, jitter). */
export function flingVelocity(samples: readonly PanSample[], releaseT: number): Fling | null {
  const recent = samples.filter((sample) => releaseT - sample.t <= VELOCITY_WINDOW_MS);
  const first = recent[0];
  const last = recent.at(-1);
  if (!first || !last || first === last) return null;
  const dt = last.t - first.t;
  if (dt < 4) return null;
  const vx = (last.x - first.x) / dt;
  const vy = (last.y - first.y) / dt;
  const speed = Math.hypot(vx, vy);
  if (speed < FLING_MIN_LAUNCH) return null;
  const clamped = Math.min(speed, FLING_MAX_SPEED);
  return { vx: (vx * clamped) / speed, vy: (vy * clamped) / speed, tauMs: flingTau(clamped) };
}

/**
 * Advances the fling by one frame. The distance is the exact integral of the decaying velocity,
 * so the glide covers the same path at any frame rate.
 */
export function decayFling(fling: Fling, dtMs: number): { dx: number; dy: number; next: Fling; done: boolean } {
  const decay = Math.exp(-dtMs / fling.tauMs);
  const travel = fling.tauMs * (1 - decay);
  const next = { vx: fling.vx * decay, vy: fling.vy * decay, tauMs: fling.tauMs };
  return { dx: fling.vx * travel, dy: fling.vy * travel, next, done: Math.hypot(next.vx, next.vy) < FLING_MIN_SPEED };
}
