import { describe, expect, it } from 'vitest';
import { fakeFrames } from '../../../../testing/fakeFrames';
import type { OrbitView } from './orbitCamera';
import { VIEW_GLIDE_MS, ViewGlide } from './viewGlide';

const start: OrbitView = { target: [0, 0, 0], yaw: 0, pitch: 0, distance: 10 };
const end: OrbitView = { target: [4, 2, -2], yaw: 1, pitch: 0.6, distance: 2.5 };

function glider(from: OrbitView = start, duration = VIEW_GLIDE_MS) {
  const frames = fakeFrames();
  let view = from;
  const placed: OrbitView[] = [];
  const glide = new ViewGlide(
    () => view,
    (next) => {
      view = next;
      placed.push(next);
    },
    frames.clock,
    () => duration,
  );
  return { glide, frames, view: () => view, placed };
}

describe('ViewGlide', () => {
  it('glides to the view over frames, eased in and out, and lands exactly on it', () => {
    const { glide, frames, view } = glider();
    glide.glideTo(end);
    expect(view()).toBe(start);
    frames.frame(VIEW_GLIDE_MS / 10);
    // Eased in: a tenth of the time covers much less than a tenth of the way.
    expect(view().target[0]).toBeGreaterThan(0);
    expect(view().target[0]).toBeLessThan(0.4 * 0.5);
    frames.frame((VIEW_GLIDE_MS * 4) / 10);
    // Halfway in time is halfway there: the target and the angles, and the distance by its ratio (10 → 5 → 2.5).
    expect(view().target).toEqual([2, 1, -1]);
    expect(view().yaw).toBeCloseTo(0.5, 10);
    expect(view().pitch).toBeCloseTo(0.3, 10);
    expect(view().distance).toBeCloseTo(5, 10);
    frames.settle();
    expect(view()).toEqual(end);
    expect(glide.gliding()).toBe(false);
  });

  it('turns the short way round', () => {
    const { glide, frames, view } = glider({ ...start, yaw: (170 * Math.PI) / 180 });
    glide.glideTo({ ...start, yaw: (-170 * Math.PI) / 180 });
    frames.frame(VIEW_GLIDE_MS / 2);
    // Through 180°, 10° each way, never back through 0°.
    expect(Math.cos(view().yaw)).toBeCloseTo(-1, 10);
    frames.settle();
    expect(Math.cos(view().yaw)).toBeCloseTo(Math.cos((170 * Math.PI) / 180), 10);
    expect(Math.sin(view().yaw)).toBeCloseTo(Math.sin((-170 * Math.PI) / 180), 10);
  });

  it('stops where it is when anything else places the camera', () => {
    const { glide, frames, view } = glider();
    glide.glideTo(end);
    frames.frame(VIEW_GLIDE_MS / 4);
    glide.stop();
    const stopped = view();
    frames.settle();
    expect(view()).toBe(stopped);
    expect(glide.gliding()).toBe(false);
  });

  it('starts again from where it is when sent somewhere else on the way', () => {
    const { glide, frames, view } = glider();
    glide.glideTo(end);
    frames.frame(VIEW_GLIDE_MS / 2);
    glide.glideTo(start);
    frames.settle();
    expect(view()).toEqual(start);
  });

  it('places the camera at once when motion is reduced', () => {
    const { glide, frames, view, placed } = glider(start, 0);
    glide.glideTo(end);
    expect(view()).toEqual(end);
    expect(placed).toHaveLength(1);
    expect(frames.animating()).toBe(false);
  });
});
