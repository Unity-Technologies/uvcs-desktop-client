import { describe, expect, it } from 'vitest';
import {
  decayFling,
  FLING_MAX_SPEED,
  FLING_MIN_LAUNCH,
  FLING_MIN_SPEED,
  FLING_TAU_MAX_MS,
  FLING_TAU_MIN_MS,
  flingTau,
  flingVelocity,
  pushPanSample,
  VELOCITY_WINDOW_MS,
  type PanSample,
} from './pan';

/** A steady drag along x at `speed` px/ms, sampled every 16ms up to `endT`. */
function steadyDrag(speed: number, endT: number): PanSample[] {
  return [5, 4, 3, 2, 1, 0].map((step) => ({ x: speed * (endT - step * 16), y: 0, t: endT - step * 16 }));
}

describe('pan inertia', () => {
  it('keeps only the samples inside the velocity window', () => {
    const samples: PanSample[] = [];
    pushPanSample(samples, { x: 0, y: 0, t: 0 });
    pushPanSample(samples, { x: 5, y: 0, t: 80 });
    pushPanSample(samples, { x: 30, y: 0, t: VELOCITY_WINDOW_MS + 60 });
    expect(samples.map((sample) => sample.t)).toEqual([80, VELOCITY_WINDOW_MS + 60]);
  });

  it('measures the speed of a steady drag', () => {
    const fling = flingVelocity(steadyDrag(1, 1000), 1000);
    expect(fling?.vx).toBeCloseTo(1);
    expect(fling?.vy).toBeCloseTo(0);
  });

  it('does not fling slow drags, parked releases or jitter', () => {
    expect(flingVelocity(steadyDrag(FLING_MIN_LAUNCH / 2, 1000), 1000)).toBeNull();
    expect(flingVelocity(steadyDrag(2, 1000), 1000 + VELOCITY_WINDOW_MS + 50)).toBeNull();
    expect(flingVelocity([{ x: 0, y: 0, t: 0 }], 0)).toBeNull();
    expect(
      flingVelocity(
        [
          { x: 0, y: 0, t: 0 },
          { x: 9, y: 0, t: 3 },
        ],
        3,
      ),
    ).toBeNull();
  });

  it('flings a short quick flick from the grab point and one move', () => {
    const flick = [
      { x: 0, y: 0, t: 0 },
      { x: 48, y: 0, t: 16 },
    ];
    expect(flingVelocity(flick, 20)?.vx).toBeCloseTo(3);
  });

  it('caps a violent flick, keeping its direction', () => {
    const violent = [
      { x: 0, y: 0, t: 0 },
      { x: 90, y: 120, t: 12 },
    ];
    const fling = flingVelocity(violent, 12)!;
    expect(Math.hypot(fling.vx, fling.vy)).toBeCloseTo(FLING_MAX_SPEED);
    expect(fling.vy / fling.vx).toBeCloseTo(120 / 90);
    expect(fling.tauMs).toBe(flingTau(FLING_MAX_SPEED));
  });

  it('glides disproportionately farther after a harder throw, within limits', () => {
    const glide = (speed: number): number => speed * flingTau(speed);
    expect(glide(4)).toBeGreaterThan(4 * glide(1));
    expect(flingTau(0)).toBe(FLING_TAU_MIN_MS);
    expect(flingTau(100)).toBe(FLING_TAU_MAX_MS);
  });

  it('decays the same at any frame rate', () => {
    const fling = { vx: 1, vy: 0, tauMs: FLING_TAU_MIN_MS };
    const half = decayFling(fling, 8);
    const rest = decayFling(half.next, 8);
    const whole = decayFling(fling, 16);
    expect(half.dx + rest.dx).toBeCloseTo(whole.dx, 6);
    expect(rest.next.vx).toBeCloseTo(whole.next.vx, 6);
  });

  it('lands within a few seconds even after the hardest throw', () => {
    let fling = { vx: FLING_MAX_SPEED, vy: 0, tauMs: flingTau(FLING_MAX_SPEED) };
    let elapsed = 0;
    let done = false;
    while (!done) {
      ({ next: fling, done } = decayFling(fling, 16));
      elapsed += 16;
    }
    expect(fling.vx).toBeLessThan(FLING_MIN_SPEED);
    expect(elapsed).toBeLessThan(6000);
  });
});
