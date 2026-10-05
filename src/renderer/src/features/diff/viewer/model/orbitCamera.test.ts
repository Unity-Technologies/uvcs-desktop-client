import { describe, expect, it } from 'vitest';
import { cameraPositionOf, clipPlanesOf, dollied, FIELD_OF_VIEW, FIRST_PITCH, FIRST_YAW, framedView, orbited, panned, type OrbitView } from './orbitCamera';

const cube = { min: [-1, 0, -1] as [number, number, number], max: [1, 2, 1] as [number, number, number] };
const front: OrbitView = { target: [0, 0, 0], yaw: 0, pitch: 0, distance: 10 };
const rounded = (values: number[]): number[] => values.map((value) => Number(value.toFixed(6)) + 0);

describe('framedView', () => {
  it('looks at the middle of the bounds from the first view', () => {
    const view = framedView(cube, 1.5);
    expect(view.target).toEqual([0, 1, 0]);
    expect([view.yaw, view.pitch]).toEqual([FIRST_YAW, FIRST_PITCH]);
  });

  it('backs off enough for the whole model to fit the narrower side of the viewport', () => {
    const radius = Math.sqrt(12) / 2;
    const wide = framedView(cube, 2);
    expect(Math.asin((radius * 1.15) / wide.distance)).toBeCloseTo((FIELD_OF_VIEW * Math.PI) / 360);
    // A tall, narrow viewport fits the model across: the camera backs off further.
    expect(framedView(cube, 0.5).distance).toBeGreaterThan(wide.distance);
  });

  it('keeps the angle it is given', () => {
    expect(framedView(cube, 1, 1, 0.2)).toMatchObject({ yaw: 1, pitch: 0.2 });
  });
});

describe('the gestures', () => {
  it('starts from the front: on +Z, the way the model faces in Unity', () => {
    expect(rounded(cameraPositionOf(front))).toEqual([0, 0, 10]);
  });

  it('orbits around the target, never over the top', () => {
    const turned = orbited(front, -100, 0);
    expect(turned.yaw).toBeCloseTo(0.6);
    expect(orbited(front, 0, 100000).pitch).toBeCloseTo((89 * Math.PI) / 180);
  });

  it('pans so what is under the pointer follows it', () => {
    // A 100 px drag right in a 1000 px tall view moves the target left by a tenth of the view's height at its depth.
    const height = 2 * 10 * Math.tan((FIELD_OF_VIEW * Math.PI) / 360);
    expect(rounded(panned(front, 100, 0, 1000).target)).toEqual(rounded([-height / 10, 0, 0]));
    expect(rounded(panned(front, 0, 100, 1000).target)).toEqual(rounded([0, height / 10, 0]));
  });

  it('zooms towards the point under the pointer, which stays put', () => {
    const closer = dollied(front, -500, [2, 0, 0]);
    expect(closer.distance).toBeCloseTo(10 * Math.exp(-1));
    expect(closer.target[0]).toBeCloseTo(2 * (1 - Math.exp(-1)));
    expect(dollied(front, 500).target).toEqual([0, 0, 0]);
  });
});

describe('clipPlanesOf', () => {
  it('holds the model between the planes, the near one as far out as it can be', () => {
    const { near, far } = clipPlanesOf({ ...front, target: [0, 1, 0] }, cube);
    expect(near).toBeCloseTo(10 - Math.sqrt(3));
    expect(far).toBeGreaterThan(10 + Math.sqrt(3));
  });
});
