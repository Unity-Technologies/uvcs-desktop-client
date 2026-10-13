import { describe, expect, it } from 'vitest';
import { wheelZoomFactor } from '../../../../lib/wheelZoom';
import { fakeFrames } from '../../../../testing/fakeFrames';
import { dollyGlide } from './dollyGlide';
import type { OrbitView, Vector } from './orbitCamera';

const NOTCH_IN = wheelZoomFactor(-100, 0);

function camera(start: OrbitView = { target: [0, 0, 0], yaw: 0, pitch: 0, distance: 10 }) {
  const frames = fakeFrames();
  let view = start;
  const glide = dollyGlide(
    () => view,
    (next) => (view = next),
    frames.clock,
  );
  return { glide, frames, view: () => view };
}

describe('dollyGlide', () => {
  it("glides a wheel notch closer over frames, not at once, the point under the pointer staying put", () => {
    const { glide, frames, view } = camera();
    const point: Vector = [2, 1, 0];
    glide.zoomStep(point, NOTCH_IN);
    frames.frame();
    expect(view().distance).toBeLessThan(10);
    expect(view().distance).toBeGreaterThan(10 / NOTCH_IN);
    frames.settle();
    expect(view().distance).toBeCloseTo(10 / NOTCH_IN, 10);
    // The target went towards the point as far as the distance shrank: the point is where it was on screen.
    view().target.forEach((value, i) => expect(value).toBeCloseTo(point[i]! * (1 - 1 / NOTCH_IN), 10));
  });

  it('compounds notches spun in a row', () => {
    const { glide, frames, view } = camera();
    glide.zoomStep(null, NOTCH_IN);
    frames.frame();
    glide.zoomStep(null, NOTCH_IN);
    frames.settle();
    expect(view().distance).toBeCloseTo(10 / NOTCH_IN / NOTCH_IN, 10);
  });

  it('stops where it is when something else sets the view', () => {
    const { glide, frames, view } = camera();
    glide.zoomStep(null, NOTCH_IN);
    frames.frame();
    glide.stop();
    const stopped = view().distance;
    frames.settle();
    expect(view().distance).toBe(stopped);
  });
});
