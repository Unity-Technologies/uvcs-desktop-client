import { describe, expect, it } from 'vitest';
import { linesToReveal, MARKER_INSET, markerLeft, markerSpots, rowsKey } from './diffAnnotations';

// Lines 1–10 unchanged, then line 11 replaced, then unchanged lines 12–40 (a hunk of 3 context lines each side).
const HUNKS = [{ deletionStart: 8, deletionCount: 7, additionStart: 8, additionCount: 7 }];

describe('linesToReveal', () => {
  it("unfolds each row's newer line once, in order", () => {
    const rows = [
      { side: 'additions', lineNumber: 30 },
      { side: 'additions', lineNumber: 2 },
      { side: 'additions', lineNumber: 30 },
    ] as const;
    expect(linesToReveal(HUNKS, rows)).toEqual([2, 30]);
  });

  it("unfolds an older side's unchanged line where the newer side has it", () => {
    const shifted = [{ deletionStart: 8, deletionCount: 7, additionStart: 8, additionCount: 9 }];
    expect(linesToReveal(shifted, [{ side: 'deletions', lineNumber: 30 }])).toEqual([32]);
  });

  it('unfolds nothing for a row above the file, or a removed line', () => {
    expect(linesToReveal(HUNKS, [{ side: 'additions', lineNumber: 0 }, { side: 'deletions', lineNumber: 11 }])).toEqual([]);
  });
});

describe('rowsKey', () => {
  it('is the same for the same rows built anew, and differs when any row does', () => {
    const rows = [{ side: 'additions', lineNumber: 4, metadata: 'additions:4' }] as const;
    expect(rowsKey([...rows])).toBe(rowsKey([...rows]));
    expect(rowsKey(rows)).not.toBe(rowsKey([{ side: 'additions', lineNumber: 5, metadata: 'additions:5' }]));
  });
});

describe('markerLeft', () => {
  it('ends a marker just inside its pane, over the end of the line, leaving the code its whole width', () => {
    expect(markerLeft(640)).toBe(640 - MARKER_INSET);
  });
});

describe('markerSpots', () => {
  const marker = (key: string, lineNumber: number) => ({ key, lineNumber });
  const box = (top: number, bottom = top + 20, paneRight = 640) => ({ top, bottom, contentLeft: 40, paneRight });

  it("places each marker at the end of its line, centered on it", () => {
    const spots = markerSpots([marker('a', 4)], new Map([['a', box(100)]]));
    expect(spots).toEqual([{ key: 'a', top: 110, left: markerLeft(640), markers: [marker('a', 4)] }]);
  });

  it('puts markers on the same row side by side, the one above the code first, instead of one over the other', () => {
    const spots = markerSpots([marker('line', 1), marker('top', 0)], new Map([['line', box(100)], ['top', box(100.4)]]));
    expect(spots.map((spot) => spot.markers.map((each) => each.key))).toEqual([['top', 'line']]);
    // Rows a fraction of a pixel apart, however they round.
    const apart = markerSpots([marker('line', 1), marker('top', 0)], new Map([['line', box(100.4)], ['top', box(100.6)]]));
    expect(apart.map((spot) => spot.markers.map((each) => each.key))).toEqual([['top', 'line']]);
  });

  it('keeps apart markers on other rows or panes, and leaves out those whose line is not rendered', () => {
    const spots = markerSpots([marker('a', 1), marker('b', 2), marker('c', 1), marker('d', 9)], new Map([['a', box(100)], ['b', box(120)], ['c', box(100, 120, 320)]]));
    expect(spots.map((spot) => spot.key)).toEqual(['a', 'b', 'c']);
  });
});
