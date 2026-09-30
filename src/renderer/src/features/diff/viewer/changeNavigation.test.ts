import { parseDiffFromFile } from '@pierre/diffs';
import { describe, expect, it } from 'vitest';
import { listChangeBlocks, listChangeRegions } from './changeBlocks';
import { adjacentChange, arrivalChange, changePositionLabel, changesAbove, currentAfterChange, modifiedLineAt, plannedMove } from './changeNavigation';

const lines = (...items: string[]) => items.map((item) => `${item}\n`).join('');
const blocksOf = (original: string, modified: string) => listChangeBlocks(parseDiffFromFile({ name: 'a.ts', contents: original }, { name: 'a.ts', contents: modified }));
const regionsOf = (original: string, modified: string) => listChangeRegions(blocksOf(original, modified));

// a B c (d removed) e f X: a change at line 2, one where d was (before e, line 4) and one at line 6.
const ORIGINAL = lines('a', 'b', 'c', 'd', 'e', 'f');
const MODIFIED = lines('a', 'B', 'c', 'e', 'f', 'X');

describe('adjacentChange', () => {
  it('moves from the current change, stopping at the first and the last', () => {
    expect(adjacentChange({ count: 3, current: 1, above: 0 }, 1)).toBe(2);
    expect(adjacentChange({ count: 3, current: 1, above: 0 }, -1)).toBe(0);
    expect(adjacentChange({ count: 3, current: 2, above: 0 }, 1)).toBeNull();
    expect(adjacentChange({ count: 3, current: 0, above: 3 }, -1)).toBeNull();
  });

  it('goes from the top of the view before the first move: down to the first change below it, up to the last above', () => {
    expect(adjacentChange({ count: 3, current: null, above: 0 }, 1)).toBe(0);
    expect(adjacentChange({ count: 3, current: null, above: 0 }, -1)).toBeNull();
    expect(adjacentChange({ count: 3, current: null, above: 2 }, 1)).toBe(2);
    expect(adjacentChange({ count: 3, current: null, above: 2 }, -1)).toBe(1);
    expect(adjacentChange({ count: 3, current: null, above: 3 }, 1)).toBeNull();
  });

  it('finds nothing in a diff without changes', () => {
    expect(adjacentChange({ count: 0, current: null, above: 0 }, 1)).toBeNull();
  });
});

describe('plannedMove', () => {
  it('moves to the next or previous change while there is one', () => {
    expect(plannedMove({ count: 3, current: 1, above: 0 }, 1, true)).toEqual({ to: 'change', index: 2 });
    expect(plannedMove({ count: 3, current: null, above: 2 }, -1, true)).toEqual({ to: 'change', index: 1 });
  });

  it('goes on to the file beside the diff past its last or first change, or nowhere without one', () => {
    expect(plannedMove({ count: 3, current: 2, above: 0 }, 1, true)).toEqual({ to: 'file' });
    expect(plannedMove({ count: 3, current: 0, above: 0 }, -1, false)).toBeNull();
    expect(plannedMove({ count: 0, current: null, above: 0 }, 1, true)).toEqual({ to: 'file' });
  });
});

describe('arrivalChange', () => {
  it('opens a diff stepped to at its first change going down and its last going up; one without changes at none', () => {
    expect(arrivalChange('first', 4)).toBe(0);
    expect(arrivalChange('last', 4)).toBe(3);
    expect(arrivalChange('last', 0)).toBeNull();
  });
});

describe('changesAbove', () => {
  const regions = regionsOf(ORIGINAL, MODIFIED);

  it('counts the changes starting above a line of the modified file', () => {
    expect(regions.map((region) => region.newStart)).toEqual([2, 4, 6]);
    expect(changesAbove(regions, 1)).toBe(0);
    expect(changesAbove(regions, 2)).toBe(0);
    expect(changesAbove(regions, 3)).toBe(1);
    expect(changesAbove(regions, 5)).toBe(2);
    expect(changesAbove(regions, 7)).toBe(3);
  });
});

describe('modifiedLineAt', () => {
  const blocks = blocksOf(ORIGINAL, MODIFIED);

  it("takes an added or unchanged line's own number", () => {
    expect(modifiedLineAt(blocks, 'additions', 5)).toBe(5);
  });

  it('puts a removed line where it was, and numbers the original lines around the changes as the modified file does', () => {
    expect(modifiedLineAt(blocks, 'deletions', 2)).toBe(2);
    expect(modifiedLineAt(blocks, 'deletions', 4)).toBe(4);
    expect(modifiedLineAt(blocks, 'deletions', 1)).toBe(1);
    expect(modifiedLineAt(blocks, 'deletions', 5)).toBe(4);
  });
});

describe('currentAfterChange', () => {
  const before = regionsOf(ORIGINAL, MODIFIED);

  it('keeps the current change while typing within one', () => {
    expect(currentAfterChange(1, before, regionsOf(ORIGINAL, lines('a', 'Bee', 'c', 'e', 'f', 'X')))).toBe(1);
  });

  it('lets it go once changes come or go', () => {
    expect(currentAfterChange(1, before, regionsOf(ORIGINAL, lines('a', 'B', 'c', 'd', 'e', 'f', 'X')))).toBeNull();
    expect(currentAfterChange(null, before, before)).toBeNull();
  });
});

describe('changePositionLabel', () => {
  it('counts the changes, then says which one is current', () => {
    expect(changePositionLabel({ count: 12, current: null })).toBe('12 changes');
    expect(changePositionLabel({ count: 1, current: null })).toBe('1 change');
    expect(changePositionLabel({ count: 1200, current: 2 })).toBe('3 of 1,200');
  });

  it('says there are none in a file only stepped past (an image, identical versions)', () => {
    expect(changePositionLabel({ count: 0, current: null })).toBe('No changes');
  });
});

describe('a version shown alone', () => {
  it('is one change, whole: an added or a deleted file', () => {
    expect(regionsOf('', lines('a', 'b', 'c'))).toHaveLength(1);
    expect(regionsOf(lines('a', 'b', 'c'), '')).toHaveLength(1);
  });
});
