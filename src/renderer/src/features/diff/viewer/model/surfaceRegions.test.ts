import { describe, expect, it } from 'vitest';
import { changedRegions, MAX_REGIONS } from './surfaceRegions';

const rounded = (regions: { min: number[]; max: number[]; vertices: number }[]) =>
  regions.map(({ min, max, vertices }) => ({ min: min.map((v) => Number(v.toFixed(4))), max: max.map((v) => Number(v.toFixed(4))), vertices }));
const mesh = (points: [number, number, number][], distances: number[]) => ({ positions: new Float32Array(points.flat()), distances: new Float32Array(distances) });

describe('changedRegions', () => {
  it('joins the changed vertices that are near into one region, biggest first', () => {
    const regions = rounded(changedRegions(
      [
        mesh(
          [
            [0, 0, 0],
            [0.02, 0, 0],
            [0.04, 0.01, 0],
            [5, 5, 5],
            [9, 9, 9],
          ],
          [1, 1, 1, 1, 0],
        ),
      ],
      0.5,
      10,
    ));
    expect(regions).toEqual([
      { min: [0, 0, 0], max: [0.04, 0.01, 0], vertices: 3 },
      { min: [5, 5, 5], max: [5, 5, 5], vertices: 1 },
    ]);
  });

  it('takes changes on both versions together', () => {
    expect(rounded(changedRegions([mesh([[1, 1, 1]], [1]), mesh([[1.01, 1, 1]], [1])], 0, 10))).toEqual([{ min: [1, 1, 1], max: [1.01, 1, 1], vertices: 2 }]);
  });

  it('finds no region where nothing moved past the tolerance', () => {
    expect(changedRegions([mesh([[0, 0, 0]], [0.1])], 0.1, 10)).toEqual([]);
  });

  it('keeps the biggest regions only, when the whole model changed', () => {
    const points = Array.from({ length: 50 }, (_, i): [number, number, number] => [i * 10, 0, 0]);
    expect(changedRegions([mesh(points, points.map(() => 1))], 0, 100)).toHaveLength(MAX_REGIONS);
  });
});
