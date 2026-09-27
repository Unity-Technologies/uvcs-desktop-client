import { parseDiffFromFile } from '@pierre/diffs';
import { describe, expect, it } from 'vitest';
import { listChangeBlocks, listChangeRegions } from './changeBlocks';
import { chipAnchorLines, chipRegion, chipTop } from './chipPlacement';

const lines = (...items: string[]) => items.map((item) => `${item}\n`).join('');
const regions = listChangeRegions(listChangeBlocks(parseDiffFromFile({ name: 'a.ts', contents: lines('a', 'b', 'c', 'd') }, { name: 'a.ts', contents: lines('a', 'B', 'c', 'x', 'd') })));
const removedOnly = listChangeRegions(listChangeBlocks(parseDiffFromFile({ name: 'a.ts', contents: lines('a', 'b', 'c') }, { name: 'a.ts', contents: lines('a', 'c') })));
const added = (lineNumber: number) => ({ side: 'additions' as const, lineNumber });
const removed = (lineNumber: number) => ({ side: 'deletions' as const, lineNumber });

describe('chipRegion', () => {
  it('is the change holding the picked lines, whatever is hovered', () => {
    expect(chipRegion(regions, [added(4)], regions[0])).toBe(regions[1]);
  });

  it('is the change hovered (or held on the way to the chip) while the diff has it', () => {
    expect(chipRegion(regions, null, regions[0])).toBe(regions[0]);
    expect(chipRegion(regions, null, { index: 0, lines: [removed(2), added(2)] })).toBeUndefined();
    expect(chipRegion(regions, null, undefined)).toBeUndefined();
  });
});

describe('chipAnchorLines', () => {
  it("sits by a change's new code side by side, and by all of it unified", () => {
    expect(chipAnchorLines(regions[0]!, 'split')).toEqual([added(2)]);
    expect(chipAnchorLines(regions[0]!, 'unified')).toEqual([removed(2), added(2)]);
  });

  it('sits by the removed lines of a change that only removes lines', () => {
    expect(chipAnchorLines(removedOnly[0]!, 'split')).toEqual([removed(2)]);
  });
});

describe('chipTop', () => {
  it("goes on the change's top edge", () => {
    expect(chipTop(100, 140, 20)).toBe(80);
    expect(chipTop(20, 40, 20)).toBe(0);
  });

  it('goes on its bottom edge when nothing is above the change', () => {
    expect(chipTop(10, 30, 20)).toBe(30);
  });
});
