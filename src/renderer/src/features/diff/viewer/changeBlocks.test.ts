import { parseDiffFromFile } from '@pierre/diffs';
import { describe, expect, it } from 'vitest';
import { blockLines, isChanged, listChangeBlocks, listChangeRegions, regionContaining, sameRegions, type DisplayMeta } from './changeBlocks';

const diff = (original: string, modified: string): DisplayMeta =>
  parseDiffFromFile({ name: 'a.ts', contents: original }, { name: 'a.ts', contents: modified });

const lines = (...items: string[]) => items.map((item) => `${item}\n`).join('');
const TWENTY = Array.from({ length: 20 }, (_, index) => `line ${index + 1}`);
const removed = (lineNumber: number) => ({ side: 'deletions' as const, lineNumber });
const added = (lineNumber: number) => ({ side: 'additions' as const, lineNumber });

describe('listChangeBlocks', () => {
  it('splits a hunk into its separate runs of changes', () => {
    const modified = [...TWENTY];
    modified[3] = 'changed 4';
    modified.splice(6, 0, 'inserted');
    expect(listChangeBlocks(diff(lines(...TWENTY), lines(...modified)))).toEqual([
      { index: 0, oldStart: 4, oldLines: 1, newStart: 4, newLines: 1 },
      { index: 1, oldStart: 7, oldLines: 0, newStart: 7, newLines: 1 },
    ]);
  });
});

describe('blockLines', () => {
  it('lists the removed lines, then the added ones', () => {
    expect(blockLines({ index: 0, oldStart: 4, oldLines: 2, newStart: 5, newLines: 1 })).toEqual([removed(4), removed(5), added(5)]);
  });
});

describe('listChangeRegions', () => {
  it('joins blocks with no unchanged line between them', () => {
    const blocks = [
      { index: 0, oldStart: 9, oldLines: 0, newStart: 9, newLines: 1 },
      { index: 1, oldStart: 9, oldLines: 1, newStart: 10, newLines: 1 },
      { index: 2, oldStart: 14, oldLines: 1, newStart: 15, newLines: 0 },
    ];
    expect(listChangeRegions(blocks)).toEqual([
      { index: 0, lines: [added(9), removed(9), added(10)] },
      { index: 1, lines: [removed(14)] },
    ]);
  });
});

describe('sameRegions', () => {
  const regionsOf = (modified: string) => listChangeRegions(listChangeBlocks(diff(lines('a', 'b', 'c', 'd'), modified)));

  it('holds while typing within a changed line', () => {
    expect(sameRegions(regionsOf(lines('a', 'B', 'c', 'd')), regionsOf(lines('a', 'Bx', 'c', 'd')))).toBe(true);
  });

  it('ends once the change covers other lines', () => {
    expect(sameRegions(regionsOf(lines('a', 'B', 'c', 'd')), regionsOf(lines('a', 'B', 'C', 'd')))).toBe(false);
    expect(sameRegions(regionsOf(lines('a', 'B', 'c', 'd')), regionsOf(lines('a', 'B', 'c', 'd', 'e')))).toBe(false);
  });
});

describe('regionContaining', () => {
  const regions = listChangeRegions(listChangeBlocks(diff(lines('a', 'b', 'c', 'd'), lines('a', 'B', 'c', 'x', 'd'))));

  it('finds the change a line belongs to, on either side', () => {
    expect(regionContaining(regions, removed(2))?.index).toBe(0);
    expect(regionContaining(regions, added(2))?.index).toBe(0);
    expect(regionContaining(regions, added(4))?.index).toBe(1);
  });

  it('finds nothing for an unchanged line', () => {
    expect(regionContaining(regions, added(3))).toBeUndefined();
    expect(regionContaining(regions, removed(4))).toBeUndefined();
  });
});

describe('isChanged', () => {
  const blocks = [
    { index: 0, oldStart: 4, oldLines: 2, newStart: 4, newLines: 1 },
    { index: 1, oldStart: 9, oldLines: 0, newStart: 8, newLines: 2 },
  ];

  it("takes a block's removed and added lines as changed", () => {
    expect([removed(4), removed(5), added(4), added(8), added(9)].every((line) => isChanged(blocks, line))).toBe(true);
  });

  it('takes no other line as changed, however the diff shows it for a moment', () => {
    // Pierre recolors lines a moment after typing stops, and shows the editor's empty last line as added.
    expect([removed(6), added(5), added(10), removed(9)].some((line) => isChanged(blocks, line))).toBe(false);
  });
});
