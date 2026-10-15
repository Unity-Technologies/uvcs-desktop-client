import { describe, expect, it } from 'vitest';
import { FIELD_OF_VIEW, FIRST_PITCH, type BoundsLike, type OrbitView, type Vector } from './orbitCamera';
import { boxedRegion, regionView } from './regionView';

/** A model 2 m across each way, centred on the origin: its diagonal is √12. */
const model: BoundsLike = { min: [-1, -1, -1], max: [1, 1, 1] };
const MODEL_SIZE = Math.sqrt(12);
const degrees = (value: number): number => (value * Math.PI) / 180;

/** A box `size` across around `centre`. */
function regionAt(centre: Vector, size = 0.2): BoundsLike {
  return { min: centre.map((value) => value - size / 2) as Vector, max: centre.map((value) => value + size / 2) as Vector };
}

/** The camera looking from `yaw`, `pitch`, 10 m away from the model's centre. */
function lookingFrom(yaw: number, pitch = FIRST_PITCH): OrbitView {
  return { target: [0, 0, 0], yaw, pitch, distance: 10 };
}

/** How much of the view's height the region's bounding sphere takes from `view`. */
function share(region: BoundsLike, view: OrbitView): number {
  const radius = Math.hypot(...region.max.map((value, i) => value - region.min[i]!)) / 2;
  return Math.tan(Math.asin(radius / view.distance)) / Math.tan(degrees(FIELD_OF_VIEW) / 2);
}

/** Where the camera is, seen from the target: a unit vector. */
function cameraSide(view: OrbitView): Vector {
  return [Math.cos(view.pitch) * Math.sin(view.yaw), Math.sin(view.pitch), Math.cos(view.pitch) * Math.cos(view.yaw)];
}

describe('regionView', () => {
  it("aims at the region's centre, close enough for it to fill a good part of the view with some of the model around", () => {
    const region = regionAt([0, 0, 1]);
    const view = regionView(region, model, lookingFrom(0), 1.5);
    view.target.forEach((value, i) => expect(value).toBeCloseTo([0, 0, 1][i]!, 10));
    expect(share(region, view)).toBeGreaterThan(0.3);
    expect(share(region, view)).toBeLessThan(0.75);
  });

  it("keeps the user's angle when the region already faces the camera: only the target and the distance change", () => {
    const view = regionView(regionAt([0.3, 0, 1]), model, lookingFrom(0.4, 0.3), 1.5);
    expect([view.yaw, view.pitch]).toEqual([0.4, 0.3]);
  });

  it('turns round to a region on the far side, looking at it from where its surface faces, at the first look\'s elevation', () => {
    const view = regionView(regionAt([0, 0, -1]), model, lookingFrom(0), 1.5);
    const side = cameraSide(view);
    expect(side[0]).toBeCloseTo(0, 10);
    expect(side[2]).toBeLessThan(0);
    expect(view.pitch).toBeCloseTo(FIRST_PITCH, 10);
  });

  it('turns to a region seen edge-on, at the side of the model', () => {
    const view = regionView(regionAt([1, 0, 0]), model, lookingFrom(0), 1.5);
    expect(view.yaw).toBeCloseTo(Math.PI / 2, 10);
  });

  it('looks down onto a region on top, keeping the way the camera faces round the model', () => {
    const view = regionView(regionAt([0, 1, 0]), model, lookingFrom(0.7, 0), 1.5);
    expect(view.yaw).toBe(0.7);
    expect(view.pitch).toBeCloseTo(degrees(50), 10);
  });

  it('looks up at a region underneath, never past the side', () => {
    const view = regionView(regionAt([0, -1, 0]), model, lookingFrom(0.7, FIRST_PITCH), 1.5);
    expect(view.pitch).toBeCloseTo(degrees(-50), 10);
  });

  it('keeps the angle for a region at the heart of the model, which faces no side more than another', () => {
    const view = regionView(regionAt([0, 0.01, 0]), model, lookingFrom(2, 0.5), 1.5);
    expect([view.yaw, view.pitch]).toEqual([2, 0.5]);
  });

  it('shows some of the model around a tiny dent, never a close-up of nothing', () => {
    const view = regionView(regionAt([0, 0, 1], 0.001), model, lookingFrom(0), 1.5);
    const shownHeight = 2 * view.distance * Math.tan(degrees(FIELD_OF_VIEW) / 2);
    expect(shownHeight).toBeGreaterThan(MODEL_SIZE * 0.1);
  });

  it('backs off further in a narrow pane, as framing does', () => {
    const region = regionAt([0, 0, 1]);
    expect(regionView(region, model, lookingFrom(0), 0.5).distance).toBeGreaterThan(regionView(region, model, lookingFrom(0), 1.5).distance);
  });
});

describe('boxedRegion', () => {
  it('boxes the region just clear of its surface: a hundredth of the model around it', () => {
    const boxed = boxedRegion(regionAt([0, 0, 1]), MODEL_SIZE);
    boxed.min.forEach((value, i) => expect(value).toBeCloseTo([-0.1, -0.1, 0.9][i]! - MODEL_SIZE * 0.01, 10));
    boxed.max.forEach((value, i) => expect(value).toBeCloseTo([0.1, 0.1, 1.1][i]! + MODEL_SIZE * 0.01, 10));
  });
});
