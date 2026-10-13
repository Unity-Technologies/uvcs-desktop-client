import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { cameraPositionOf, clipPlanesOf, dollied, FIELD_OF_VIEW, FIRST_PITCH, FIRST_YAW, flown, flyStep, framedView, orbited, panned, pointOnRay, workingDepth, type OrbitView, type Vector } from './orbitCamera';

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

describe('panned at the depth grabbed', () => {
  /** Where a point shows on a viewport of `height` square pixels through the camera of `view`. */
  function onScreen(view: OrbitView, point: Vector, height = 800): [number, number] {
    const camera = new PerspectiveCamera(FIELD_OF_VIEW, 1, 0.001, 1e6);
    camera.position.set(...cameraPositionOf(view));
    camera.lookAt(...view.target);
    camera.updateMatrixWorld();
    const projected = new Vector3(...point).project(camera);
    return [((projected.x + 1) / 2) * height, ((1 - projected.y) / 2) * height];
  }

  it.each([
    ['a model behind a target zoomed close', [0.3, 0.2, -40] as Vector],
    ['a part nearer than the target', [-0.5, 0.1, 6] as Vector],
  ])('keeps what it grabbed under the pointer, %s', (_, grabbed) => {
    const view: OrbitView = { target: [0, 0, 0], yaw: 0, pitch: 0.2, distance: 10 };
    const before = onScreen(view, grabbed);
    const moved = panned(view, 120, -45, 800, workingDepth(view, grabbed, null));
    const after = onScreen(moved, grabbed);
    expect(after[0] - before[0]).toBeCloseTo(120, 6);
    expect(after[1] - before[1]).toBeCloseTo(-45, 6);
  });
});

describe('workingDepth', () => {
  const view: OrbitView = { target: [0, 0, 0], yaw: 0, pitch: 0, distance: 2 };

  it("is what is under the pointer, else the model's centre, else the target", () => {
    // The camera is at z = 2, looking down -Z.
    expect(workingDepth(view, [5, 0, -8], [0, 0, -30])).toBeCloseTo(10);
    expect(workingDepth(view, null, [0, 0, -30])).toBeCloseTo(32);
    expect(workingDepth(view, null, null)).toBe(2);
  });

  it("takes the target's depth when the centre is behind the camera, inside a level", () => {
    expect(workingDepth(view, null, [0, 0, 50])).toBe(2);
  });
});

describe('pointOnRay', () => {
  it('is the point of the ray as deep as asked, along where the camera looks', () => {
    // The camera at z = 10 looks down -Z; a ray to the right of the centre.
    const view: OrbitView = { target: [0, 0, 0], yaw: 0, pitch: 0, distance: 10 };
    const direction = new Vector3(1, 0, -2).normalize().toArray() as Vector;
    const point = pointOnRay(view, { origin: cameraPositionOf(view), direction }, 20);
    point.forEach((value, i) => expect(value).toBeCloseTo([10, 0, -10][i]!, 10));
  });
});

describe('flyStep', () => {
  it('starts at half the depth a second and speeds up while held, to five times that, then holds', () => {
    expect(flyStep(10, 0, 1)).toBeCloseTo(5);
    expect(flyStep(10, 0.75, 1)).toBeCloseTo(15);
    expect(flyStep(10, 1.5, 1)).toBeCloseTo(25);
    expect(flyStep(10, 9, 1)).toBeCloseTo(25);
    expect(flyStep(10, 0, 1, true)).toBeCloseTo(20);
  });
});

describe('flown', () => {
  const view: OrbitView = { target: [0, 0, 0], yaw: 0, pitch: 0, distance: 10 };
  const close = (actual: Vector, expected: Vector) => actual.forEach((value, i) => expect(value).toBeCloseTo(expected[i]!, 10));

  it('moves where the camera looks, the target with it, right, and straight up', () => {
    // At yaw 0 the camera looks from +Z towards -Z.
    const forward = flown(view, { forward: 1, right: 0, up: 0 }, 10);
    close(forward.target, [0, 0, -10]);
    expect(forward.distance).toBe(10);
    close(flown(view, { forward: 0, right: 1, up: 0 }, 5).target, [5, 0, 0]);
    close(flown(view, { forward: 0, right: 0, up: -1 }, 1).target, [0, -1, 0]);
  });

  it('goes down as it goes forward while looking down', () => {
    close(flown({ ...view, pitch: Math.PI / 2 }, { forward: 1, right: 0, up: 0 }, 10).target, [0, -10, 0]);
  });
});
