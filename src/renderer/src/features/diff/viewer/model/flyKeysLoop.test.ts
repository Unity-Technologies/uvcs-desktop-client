import '../../../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import type { PressedKey } from '../../../../lib/shortcuts';
import { fakeFrames, FRAME_MS } from '../../../../testing/fakeFrames';
import { FlyKeysLoop } from './flyKeysLoop';
import type { OrbitView } from './orbitCamera';

const key = (code: string, modifiers: Partial<PressedKey> = {}): PressedKey => ({
  key: code.startsWith('Key') ? code.slice(3).toLowerCase() : code,
  code,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...modifiers,
});

/** A camera at z = 10 looking down -Z, the model's centre at the origin (10 deep). */
function flying() {
  const frames = fakeFrames();
  let view: OrbitView = { target: [0, 0, 0], yaw: 0, pitch: 0, distance: 10 };
  const loop = new FlyKeysLoop(
    () => view,
    (next) => (view = next),
    () => [0, 0, 0],
    frames.clock,
  );
  return { loop, frames, x: () => view.target[0], z: () => view.target[2] };
}

describe('FlyKeysLoop', () => {
  it('moves every frame while a key is held, and stops once it is let go', () => {
    const { loop, frames, z } = flying();
    expect(loop.keyDown(key('KeyW'))).toBe(true);
    frames.frame();
    frames.frame();
    const moved = z();
    expect(moved).toBeLessThan(0);
    loop.keyUp(key('KeyW'));
    frames.settle();
    expect(z()).toBe(moved);
    expect(frames.animating()).toBe(false);
  });

  it('takes no key it has no move for', () => {
    expect(flying().loop.keyDown(key('KeyF'))).toBe(false);
  });

  it('speeds up while held', () => {
    // Sideways, so the model stays as deep and only the time held changes the pace.
    const { loop, frames, x } = flying();
    loop.keyDown(key('KeyD'));
    frames.frame();
    const first = x();
    for (let i = 0; i < 60; i++) frames.frame();
    const before = x();
    frames.frame();
    expect(x() - before).toBeGreaterThan(first * 2);
  });

  it('goes faster as soon as Shift is pressed, a key already held', () => {
    const { loop, frames, z } = flying();
    loop.keyDown(key('KeyW'));
    frames.frame();
    const slow = -z();
    loop.keyDown(key('Shift', { shiftKey: true }));
    const before = z();
    frames.frame();
    expect(before - z()).toBeGreaterThan(slow * 3);
  });

  it("stops when ⌘, Ctrl or Alt joins in: macOS sends no key up for a key let go under ⌘", () => {
    for (const modifier of [key('Meta', { metaKey: true }), key('Control', { ctrlKey: true }), key('Alt', { altKey: true })]) {
      const { loop, frames, z } = flying();
      loop.keyDown(key('KeyW'));
      frames.frame();
      expect(loop.keyDown(modifier)).toBe(false);
      const stopped = z();
      frames.settle();
      expect(z()).toBe(stopped);
    }
  });

  it('stops when the stage loses focus, keys still down', () => {
    const { loop, frames, z } = flying();
    loop.keyDown(key('KeyD'));
    frames.frame();
    loop.stop();
    const stopped = z();
    frames.settle();
    expect(z()).toBe(stopped);
  });

  it("never jumps after a stall: a frame counts at most a tenth of a second", () => {
    const { loop, frames, z } = flying();
    loop.keyDown(key('KeyW'));
    frames.frame(FRAME_MS);
    const start = z();
    frames.frame(5000);
    // Half the depth (10) a second, at most five times that once sped up: a tenth of a second is at most 5.
    expect(start - z()).toBeLessThanOrEqual(5);
  });
});
