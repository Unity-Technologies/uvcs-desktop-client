import { Matrix4, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { fbxAxisConversion, Y_UP_AXES } from './fbxAxes';

/** Where a file point lands on Unity's axes (before the X mirror). */
const converted = (axes: Parameters<typeof fbxAxisConversion>[0], point: [number, number, number]): number[] =>
  new Vector3(...point).applyMatrix4(new Matrix4().fromArray(fbxAxisConversion(axes))).toArray().map((v) => v + 0);

describe('fbxAxisConversion', () => {
  it('leaves a Y-up file (Maya, Blender) as it is', () => {
    expect(fbxAxisConversion(Y_UP_AXES)).toEqual(new Matrix4().elements);
  });

  it('stands 3ds Max axes (Z up, -Y front) on Y, as a -90° turn on X does', () => {
    const max = { upAxis: 2, upAxisSign: 1, frontAxis: 1, frontAxisSign: -1, coordAxis: 0, coordAxisSign: 1 };
    expect(converted(max, [0, 0, 10])).toEqual([0, 10, 0]);
    expect(converted(max, [0, -1, 0])).toEqual([0, 0, 1]);
    expect(converted(max, [1, 0, 0])).toEqual([1, 0, 0]);
  });

  it('follows the front axis of a Z-up file whose front is X', () => {
    const zUpFrontX = { upAxis: 2, upAxisSign: 1, frontAxis: 0, frontAxisSign: 1, coordAxis: 1, coordAxisSign: 1 };
    expect(converted(zUpFrontX, [5, 0, 0])).toEqual([0, 0, 5]);
    expect(converted(zUpFrontX, [0, 3, 0])).toEqual([3, 0, 0]);
    expect(converted(zUpFrontX, [0, 0, 2])).toEqual([0, 2, 0]);
  });

  it('flips an axis whose sign is negative', () => {
    expect(converted({ ...Y_UP_AXES, upAxisSign: -1 }, [0, 1, 0])).toEqual([0, -1, 0]);
  });

  it('reads axes that name one axis twice as Y up', () => {
    expect(fbxAxisConversion({ ...Y_UP_AXES, frontAxis: 1 })).toEqual(new Matrix4().elements);
  });
});
