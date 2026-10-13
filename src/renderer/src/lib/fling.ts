/**
 * Inertia for dragging a view with the mouse (the Branch Explorer's graph). Trackpad scrolling already coasts (the OS
 * bakes inertia into its wheel events), but a drag would stop dead on release. The release velocity is estimated from
 * the last pointer samples and then decays exponentially. The frame loop lives in panInertia.ts.
 */

/** A pointer position during a drag: screen px and ms. */
export interface PanSample {
  x: number;
  y: number;
  t: number;
}

/** Only this recent movement counts: pausing before letting go parks the view. */
export const VELOCITY_WINDOW_MS = 100;
/** px/ms below which a release is a positioning drag, not a fling. */
export const FLING_MIN_LAUNCH = 0.25;
/** px/ms below which the glide has landed. */
export const FLING_MIN_SPEED = 0.01;

/** How a view coasts after a fling: its speed ceiling, and a decay time that grows with the launch speed. */
export interface FlingFeel {
  /** px/ms ceiling, so a violent flick glides fast but never teleports. */
  maxSpeed: number;
  tauMinMs: number;
  tauMaxMs: number;
  tauPerSpeedMs: number;
}

/** The Branch Explorer's: a gentle push parks nearby, a hard throw sails across the graph. */
export const LONG_FLING: FlingFeel = { maxSpeed: 9, tauMinMs: 180, tauMaxMs: 800, tauPerSpeedMs: 75 };
/** The model viewer's: a little coast that settles within a quarter of a second, never a drift away from the model. */
export const SHORT_FLING: FlingFeel = { maxSpeed: 4, tauMinMs: 90, tauMaxMs: 250, tauPerSpeedMs: 50 };

export interface Fling {
  vx: number;
  vy: number;
  tauMs: number;
}

export function flingTau(speed: number, feel: FlingFeel = LONG_FLING): number {
  return Math.min(feel.tauMaxMs, feel.tauMinMs + feel.tauPerSpeedMs * speed);
}

/** Adds a sample, dropping the ones older than the velocity window. */
export function pushPanSample(samples: PanSample[], sample: PanSample): void {
  samples.push(sample);
  while (samples.length > 0 && sample.t - samples[0]!.t > VELOCITY_WINDOW_MS) samples.shift();
}

/** The release velocity, or null when the release should not fling (parked pointer, slow drag, jitter). */
export function flingVelocity(samples: readonly PanSample[], releaseT: number, feel: FlingFeel = LONG_FLING): Fling | null {
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
  const clamped = Math.min(speed, feel.maxSpeed);
  return { vx: (vx * clamped) / speed, vy: (vy * clamped) / speed, tauMs: flingTau(clamped, feel) };
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
