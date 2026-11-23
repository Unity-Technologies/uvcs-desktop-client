import { Matrix4 } from 'three';
import { describe, expect, it } from 'vitest';
import { cameraPositionOf, FIRST_PITCH, type OrbitView, type Vector } from './orbitCamera';
import { viewOfSpot } from './spotView';

const MODEL = { min: [-1, 0, -1] as Vector, max: [1, 2, 1] as Vector };
const FRONT: OrbitView = { target: [0, 1, 0], yaw: 0, pitch: FIRST_PITCH, distance: 8 };
/** A file in centimetres, Z up: its Z is the viewer's Y, its Y the viewer's -Z. */
const CENTIMETRES_Z_UP = new Matrix4().makeRotationX(-Math.PI / 2).multiply(new Matrix4().makeScale(0.01, 0.01, 0.01));

const close = (vector: Vector) => vector.map((value) => Number(value.toFixed(6)) + 0);

describe('viewOfSpot', () => {
  it('looks from where its author looked, carried into the viewer’s units and axes, at the point', () => {
    // 300 cm above the point, in the file's Z: 3 m above it in the viewer's Y.
    const view = viewOfSpot([0.5, 1, 0], { direction: { x: 0, y: 0, z: 1 }, distance: 300 }, CENTIMETRES_Z_UP, FRONT, MODEL, 1.5);
    expect(view.target).toEqual([0.5, 1, 0]);
    expect(view.distance).toBeCloseTo(3);
    expect(close(cameraPositionOf(view))).toEqual(close([0.5, 1 + 3 * Math.sin((89 * Math.PI) / 180), 3 * Math.cos((89 * Math.PI) / 180)]));
  });

  it('turns to the side the author looked from', () => {
    // From the file's +X: the viewer's +X, a quarter turn from the front.
    const view = viewOfSpot([0, 1, 0], { direction: { x: 1, y: 0, z: 0 }, distance: 200 }, CENTIMETRES_Z_UP, FRONT, MODEL, 1.5);
    expect(view.yaw).toBeCloseTo(Math.PI / 2);
    expect(view.pitch).toBeCloseTo(0);
    expect(close(cameraPositionOf(view))).toEqual([2, 1, 0]);
  });

  it("faces a point from the side its surface faces when the comment doesn't say where its author looked, the point in the middle", () => {
    // On the model's back, turned away from the front camera: it turns round to face it.
    const view = viewOfSpot([0, 1, -1], undefined, CENTIMETRES_Z_UP, FRONT, MODEL, 1.5);
    expect(close(view.target)).toEqual([0, 1, -1]);
    expect(Math.abs(view.yaw)).toBeCloseTo(Math.PI);
  });
});
