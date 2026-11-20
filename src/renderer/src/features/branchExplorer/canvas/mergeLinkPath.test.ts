import { describe, expect, it } from 'vitest';
import { linkCurve, pointOnCurve, type Point } from './curves';
import { BAND_HEIGHT, COLUMN_WIDTH, ROW_HEIGHT } from './geometry';
import { mergeLinkPath, pathPoints, RUN_ABOVE, RUN_BELOW, runY, SHALLOW_RATIO, type LinkPath } from './mergeLinkPath';

const source = { x: 0, y: 0 };

/** Points along the whole path, close enough to see where it goes. */
function sampled(path: LinkPath): Point[] {
  return path.flatMap((curve) => Array.from({ length: 41 }, (_, index) => pointOnCurve(curve, index / 40)));
}

/**
 * How far across the path travels inside the band around one of its ends, on that end's half of the path (two ends
 * on the same row share a band): a line crossing the band travels little.
 */
function widthInsideBand(path: LinkPath, end: Point, otherEnd: Point): number {
  const middle = (end.x + otherEnd.x) / 2;
  const onEndsHalf = (point: Point): boolean => Math.sign(point.x - middle) === Math.sign(end.x - middle);
  const inside = sampled(path).filter((point) => onEndsHalf(point) && Math.abs(point.y - end.y) < BAND_HEIGHT / 2);
  return inside.length === 0 ? 0 : Math.max(...inside.map((point) => point.x)) - Math.min(...inside.map((point) => point.x));
}

/** The angle, in degrees from flat, at which the path leaves its first point or reaches its last. */
function slantAt(path: LinkPath, end: 'leaving' | 'arriving'): number {
  const [from, towards] = end === 'leaving' ? [path[0]![0], path[0]![1]] : [path[path.length - 1]![3], path[path.length - 1]![2]];
  return (Math.atan2(Math.abs(towards.y - from.y), Math.abs(towards.x - from.x)) * 180) / Math.PI;
}

describe('mergeLinkPath', () => {
  it('keeps the S-curve for a steep link', () => {
    const to = { x: 2 * COLUMN_WIDTH, y: 3 * ROW_HEIGHT };
    expect(mergeLinkPath(source, to)).toEqual([linkCurve(source, to)]);
  });

  it('keeps the S-curve up to the shallow ratio, and routes past it', () => {
    const rise = ROW_HEIGHT;
    expect(mergeLinkPath(source, { x: SHALLOW_RATIO * rise, y: rise })).toHaveLength(1);
    expect(mergeLinkPath(source, { x: SHALLOW_RATIO * rise + 1, y: rise }).length).toBeGreaterThan(1);
  });

  it('routes a link between rows at the same height, which the S-curve would draw along the band', () => {
    expect(mergeLinkPath(source, { x: 2 * COLUMN_WIDTH, y: 0 }).length).toBeGreaterThan(1);
  });

  it.each([
    ['down a row', { x: 40 * COLUMN_WIDTH, y: ROW_HEIGHT }],
    ['up a row', { x: 40 * COLUMN_WIDTH, y: -ROW_HEIGHT }],
    ['down three rows', { x: 40 * COLUMN_WIDTH, y: 3 * ROW_HEIGHT }],
    ['along the same row', { x: 40 * COLUMN_WIDTH, y: 0 }],
    ['back to an older column', { x: -40 * COLUMN_WIDTH, y: ROW_HEIGHT }],
  ])('crosses the bands of both ends instead of running along them, %s', (_, to) => {
    const path = mergeLinkPath(source, to);
    expect(widthInsideBand(path, source, to)).toBeLessThan(COLUMN_WIDTH / 2);
    expect(widthInsideBand(path, to, source)).toBeLessThan(COLUMN_WIDTH / 2);
  });

  it('leaves its source and reaches its destination on a slant, never flat nor at a right angle', () => {
    const path = mergeLinkPath(source, { x: 40 * COLUMN_WIDTH, y: ROW_HEIGHT });
    for (const end of ['leaving', 'arriving'] as const) {
      expect(slantAt(path, end)).toBeGreaterThan(30);
      expect(slantAt(path, end)).toBeLessThan(60);
    }
  });

  it('runs flat beside the destination, on the side the source is on', () => {
    const below = { x: 40 * COLUMN_WIDTH, y: ROW_HEIGHT };
    const above = { x: 40 * COLUMN_WIDTH, y: -ROW_HEIGHT };
    expect(runY(source, below)).toBe(below.y - RUN_ABOVE);
    expect(runY(source, above)).toBe(above.y + RUN_BELOW);
    const [, run] = mergeLinkPath(source, below);
    expect(run!.map((point) => point.y)).toEqual([below.y - RUN_ABOVE, below.y - RUN_ABOVE, below.y - RUN_ABOVE, below.y - RUN_ABOVE]);
  });

  it('runs a level link through the strip above its row', () => {
    const to = { x: 40 * COLUMN_WIDTH, y: 0 };
    expect(runY(source, to)).toBe(-RUN_ABOVE);
  });

  it('draws one unbroken line from source to destination', () => {
    for (const to of [{ x: 40 * COLUMN_WIDTH, y: ROW_HEIGHT }, { x: 3 * COLUMN_WIDTH, y: 0 }, { x: -40 * COLUMN_WIDTH, y: -ROW_HEIGHT }]) {
      const path = mergeLinkPath(source, to);
      expect(path[0]![0]).toEqual(source);
      expect(path[path.length - 1]![3]).toEqual(to);
      for (let index = 1; index < path.length; index++) expect(path[index]![0]).toEqual(path[index - 1]![3]);
    }
  });

  it('makes a short link two slants with no run, still within its two ends', () => {
    const to = { x: COLUMN_WIDTH, y: 0 };
    const path = mergeLinkPath(source, to);
    expect(path).toHaveLength(2);
    for (const point of pathPoints(path)) {
      expect(point.x).toBeGreaterThanOrEqual(source.x);
      expect(point.x).toBeLessThanOrEqual(to.x);
    }
  });
});
