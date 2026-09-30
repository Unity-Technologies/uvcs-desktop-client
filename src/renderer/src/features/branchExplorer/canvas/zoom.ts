import { MAX_ZOOM, MIN_ZOOM } from './viewport';

/**
 * Smooth zooming with the mouse wheel. A trackpad pinch streams many tiny deltas and is applied 1:1;
 * a wheel notch is one big step, so it becomes an eased glide instead. Each step multiplies an accumulated
 * target (spinning during a glide compounds it and stretches the glide a little, which reads as momentum);
 * reversing direction starts over from the current zoom. The frame loop lives in zoomAnimation.ts.
 */

/** Zoom change per click of a zoom button or press of +/-. */
export const ZOOM_STEP = 1.25;
/** Zoom change per wheel notch (about 11%). */
const NOTCH_SENSITIVITY = 0.1;
/** Ceiling for accelerated wheels that report several notches in one event. */
const MAX_SENSITIVITY = 0.5;
/** One notch glides for this long… */
export const ZOOM_GLIDE_MS = 200;
/** …and continued spinning stretches the glide up to this. */
export const ZOOM_GLIDE_MAX_MS = 300;

/** Fast start, gentle landing. */
export function cubicEaseOut(t: number): number {
  return 1 - (1 - t) ** 3;
}

/**
 * A physical wheel notch (about 100px, or line/page mode, which only wheels use) versus a trackpad
 * pinch or scroll, which Chromium reports as small pixel deltas.
 */
export function isDiscreteWheel(deltaY: number, deltaMode: number): boolean {
  return deltaMode !== 0 || Math.abs(deltaY) >= 40;
}

/** Zoom factor for one wheel event; spinning up (negative delta) zooms in. */
export function wheelZoomFactor(deltaY: number, deltaMode: number): number {
  const notches = Math.abs(deltaMode === 1 ? deltaY / 3 : deltaY / 100);
  const sensitivity = Math.min(MAX_SENSITIVITY, NOTCH_SENSITIVITY * Math.max(1, notches));
  return deltaY < 0 ? 1 / (1 - sensitivity) : 1 - sensitivity;
}

/** A zoom gesture in flight. */
export interface ZoomMomentum {
  /** Where the zoom is heading, within the zoom limits. */
  target: number;
  direction: 1 | -1;
  /** When the latest step arrived; each step restarts the clock. */
  startedAt: number;
  duration: number;
}

/** Folds one zoom step (wheel notch, button, key) into the gesture in flight. */
export function accumulateZoom(previous: ZoomMomentum | null, currentZoom: number, factor: number, now: number): ZoomMomentum {
  const direction = factor > 1 ? 1 : -1;
  const carried = previous?.direction === direction ? previous : null;
  const target = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, (carried ? carried.target : currentZoom) * factor));
  const remaining = carried ? carried.startedAt + carried.duration - now : 0;
  const duration = carried && remaining > 0 ? Math.min(ZOOM_GLIDE_MAX_MS, carried.duration + remaining) : ZOOM_GLIDE_MS;
  return { target, direction, startedAt: now, duration };
}
