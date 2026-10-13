import { describe, expect, it } from 'vitest';
import { SHORT_FLING } from '../../../../lib/fling';
import { fakeFrames } from '../../../../testing/fakeFrames';
import type { OrbitView } from './orbitCamera';
import { ViewCoast } from './viewCoast';

/** A coast that moves the target one unit per pixel, flung from a quick drag to the right. */
function flung() {
  const frames = fakeFrames();
  let view: OrbitView = { target: [0, 0, 0], yaw: 0, pitch: 0, distance: 10 };
  const coast = new ViewCoast(
    () => view,
    (next) => (view = next),
    (current, dx) => ({ ...current, target: [current.target[0] + dx, 0, 0] }),
    frames.clock,
    SHORT_FLING,
  );
  for (let i = 0; i <= 5; i++) {
    coast.sample(i * 20, 0, frames.clock.now());
    frames.wait(16);
  }
  coast.release();
  return { frames, x: () => view.target[0], place: (next: OrbitView) => (view = next) };
}

describe('ViewCoast', () => {
  it('goes on moving the view once let go, and settles', () => {
    const { frames, x } = flung();
    frames.frame();
    expect(x()).toBeGreaterThan(0);
    frames.settle();
    expect(frames.animating()).toBe(false);
  });

  it('stops for good when something else places the camera (F, the keys) while it coasts', () => {
    const { frames, x, place } = flung();
    frames.frame();
    place({ target: [100, 0, 0], yaw: 0, pitch: 0, distance: 10 });
    frames.frame();
    expect(x()).toBe(100);
    expect(frames.animating()).toBe(false);
  });

  it('stops too when the camera is placed before its first frame, just let go', () => {
    const { frames, x, place } = flung();
    place({ target: [100, 0, 0], yaw: 0, pitch: 0, distance: 10 });
    frames.settle();
    expect(x()).toBe(100);
  });
});
