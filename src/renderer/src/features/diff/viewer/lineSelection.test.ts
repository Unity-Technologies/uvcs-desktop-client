import { parseDiffFromFile } from '@pierre/diffs';
import { describe, expect, it } from 'vitest';
import { listChangeBlocks, listChangeRegions } from './changeBlocks';
import { changedLinesInRange, linesRange, regionRange } from './lineSelection';

const lines = (...items: string[]) => items.map((item) => `${item}\n`).join('');
// a, b → B C (changed), c, d removed, e, f added.
const blocks = listChangeBlocks(
  parseDiffFromFile({ name: 'a.cs', contents: lines('a', 'b', 'c', 'd', 'e') }, { name: 'a.cs', contents: lines('a', 'B', 'C', 'c', 'e', 'f') }),
);
const removed = (lineNumber: number) => ({ side: 'deletions' as const, lineNumber });
const added = (lineNumber: number) => ({ side: 'additions' as const, lineNumber });

describe('changedLinesInRange', () => {
  it('takes a single changed line', () => {
    expect(changedLinesInRange(blocks, { start: 3, side: 'additions', end: 3 }, 'split')).toEqual([added(3)]);
  });

  it('takes nothing on unchanged lines', () => {
    expect(changedLinesInRange(blocks, { start: 1, side: 'additions', end: 1 }, 'unified')).toEqual([]);
  });

  it('stays on one side, side by side', () => {
    expect(changedLinesInRange(blocks, { start: 1, side: 'additions', end: 6, endSide: 'additions' }, 'split')).toEqual([added(2), added(3), added(6)]);
    expect(changedLinesInRange(blocks, { start: 1, side: 'deletions', end: 5, endSide: 'deletions' }, 'split')).toEqual([removed(2), removed(4)]);
  });

  it('spans removed and added lines in the unified order', () => {
    expect(changedLinesInRange(blocks, { start: 2, side: 'deletions', end: 2, endSide: 'additions' }, 'unified')).toEqual([removed(2), added(2)]);
    expect(changedLinesInRange(blocks, { start: 3, side: 'additions', end: 4, endSide: 'deletions' }, 'unified')).toEqual([added(3), removed(4)]);
  });

  it('crosses sides, side by side', () => {
    expect(changedLinesInRange(blocks, { start: 2, side: 'deletions', end: 3, endSide: 'additions' }, 'split')).toEqual([removed(2), added(2), added(3)]);
  });

  it('works backwards', () => {
    expect(changedLinesInRange(blocks, { start: 6, side: 'additions', end: 5, endSide: 'additions' }, 'unified')).toEqual([added(6)]);
  });
});

describe('regionRange', () => {
  it('covers exactly the change', () => {
    for (const region of listChangeRegions(blocks)) {
      expect(changedLinesInRange(blocks, regionRange(region), 'unified')).toEqual(region.lines);
      expect(changedLinesInRange(blocks, regionRange(region), 'split')).toEqual(region.lines);
    }
  });
});

describe('linesRange', () => {
  it('trims a pick to its changed lines, keeping the same lines', () => {
    const picks = [
      { start: 1, side: 'additions' as const, end: 6, endSide: 'additions' as const },
      { start: 1, side: 'deletions' as const, end: 5, endSide: 'deletions' as const },
      { start: 2, side: 'deletions' as const, end: 3, endSide: 'additions' as const },
    ];
    for (const layout of ['split', 'unified'] as const) {
      for (const pick of picks) {
        const picked = changedLinesInRange(blocks, pick, layout);
        expect(changedLinesInRange(blocks, linesRange(picked), layout)).toEqual(picked);
      }
    }
    expect(linesRange([added(2), added(3), added(6)])).toEqual({ start: 2, side: 'additions', end: 6, endSide: 'additions' });
  });
});
