import { describe, expect, it } from 'vitest';
import { findChangedRegions, regionCounter, steppableRegions, steppedRegion } from './changedRegions';

/** Differences drawn as text: '#' changed (255), '.' unchanged (0). */
function differences(rows: string[]): { difference: Uint8Array; width: number; height: number } {
  const width = rows[0]!.length;
  const difference = new Uint8Array(width * rows.length);
  rows.forEach((row, y) => [...row].forEach((cell, x) => (difference[y * width + x] = cell === '#' ? 255 : 0)));
  return { difference, width, height: rows.length };
}

function regionsOf(rows: string[], options?: Parameters<typeof findChangedRegions>[4]) {
  const { difference, width, height } = differences(rows);
  return findChangedRegions(difference, width, height, 0, options);
}

describe('findChangedRegions', () => {
  it('boxes a cluster of changed pixels, counting them', () => {
    expect(regionsOf(['........', '..##....', '..###...', '........'])).toEqual([{ x: 2, y: 1, width: 3, height: 2, pixels: 5 }]);
  });

  it('joins pixels touching at a corner', () => {
    expect(regionsOf(['#..', '.#.', '..#'], { mergeGap: 0 })).toEqual([{ x: 0, y: 0, width: 3, height: 3, pixels: 3 }]);
  });

  it('keeps distant clusters apart, in reading order', () => {
    const regions = regionsOf(['.................#', '..................', '..................', '#.................'], { mergeGap: 2 });
    expect(regions.map(({ x, y }) => ({ x, y }))).toEqual([
      { x: 17, y: 0 },
      { x: 0, y: 3 },
    ]);
  });

  it('merges clusters within the gap into one region', () => {
    expect(regionsOf(['#...#', '.....'], { mergeGap: 4 })).toEqual([{ x: 0, y: 0, width: 5, height: 1, pixels: 2 }]);
  });

  it('leaves out pixels changed no more than the tolerance', () => {
    expect(findChangedRegions(new Uint8Array([5, 0, 200, 0]), 4, 1, 10, { mergeGap: 0 })).toEqual([{ x: 2, y: 0, width: 1, height: 1, pixels: 1 }]);
  });

  it('boxes all the change at once when there are too many clusters to be anything but noise', () => {
    expect(regionsOf(['#.#.#', '.....'], { mergeGap: 0, maxClusters: 2 })).toEqual([{ x: 0, y: 0, width: 5, height: 1, pixels: 3 }]);
  });

  it('doubles the gap until the regions fit', () => {
    expect(regionsOf(['#....#....#'], { mergeGap: 3, maxRegions: 1 })).toEqual([{ x: 0, y: 0, width: 11, height: 1, pixels: 3 }]);
  });
});

describe('steppableRegions', () => {
  const frame = { width: 100, height: 100 };

  it('offers no step to a lone region covering almost the whole frame', () => {
    expect(steppableRegions([{ x: 2, y: 3, width: 95, height: 94, pixels: 1 }], frame)).toEqual([]);
  });

  it('keeps a region covering only part of the frame, and every region when there are several', () => {
    const tall = { x: 0, y: 0, width: 10, height: 100, pixels: 1 };
    const whole = { x: 0, y: 0, width: 100, height: 100, pixels: 1 };
    expect(steppableRegions([tall], frame)).toEqual([tall]);
    expect(steppableRegions([tall, whole], frame)).toEqual([tall, whole]);
  });
});

describe('steppedRegion', () => {
  it('starts at the first region going on and at the last going back', () => {
    expect(steppedRegion(null, 1, 3)).toBe(0);
    expect(steppedRegion(null, -1, 3)).toBe(2);
  });

  it('goes round past either end', () => {
    expect(steppedRegion(2, 1, 3)).toBe(0);
    expect(steppedRegion(0, -1, 3)).toBe(2);
    expect(steppedRegion(1, 1, 3)).toBe(2);
  });
});

describe('regionCounter', () => {
  it('counts the regions until stepping, then says which one shows', () => {
    expect(regionCounter(3, null)).toBe('3 regions');
    expect(regionCounter(3, 1)).toBe('2 of 3');
    expect(regionCounter(1, null)).toBe('1 region');
    expect(regionCounter(1, 0)).toBe('1 region');
  });
});
