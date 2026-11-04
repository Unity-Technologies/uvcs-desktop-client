import { parseDiffFromFile } from '@pierre/diffs';
import { describe, expect, it } from 'vitest';
import { countCalls } from '@shared/testing/countCalls';
import { listChangeBlocks, listChangeRegions, type ChangedLine, type ChangeRegion } from './changeBlocks';
import { changeKindOf, changeMarkLabel, changeMarks, FUSE_GAP, FUSE_LINES, MIN_MARK_HEIGHT, placesAgain, scrollTopForTrackPoint, showsChangeMap, type ChangeMapLayout, type LineBox, type MarksPlacedFrom } from './changeMarks';

const ROW = 20;
const removed = (lineNumber: number): ChangedLine => ({ side: 'deletions', lineNumber });
const added = (lineNumber: number): ChangedLine => ({ side: 'additions', lineNumber });
const region = (index: number, ...lines: ChangedLine[]): ChangeRegion => ({ index, lines, newStart: lines.find((line) => line.side === 'additions')?.lineNumber ?? 1 });

const regionsOf = (original: string, modified: string): ChangeRegion[] =>
  listChangeRegions(listChangeBlocks(parseDiffFromFile({ name: 'a.ts', contents: original }, { name: 'a.ts', contents: modified })));
const text = (lines: string[]): string => lines.map((line) => `${line}\n`).join('');
const numbered = (count: number): string[] => Array.from({ length: count }, (_, index) => `line ${index + 1}`);

/** A layout where every line of the modified side is a row of its own, as Pierre lays out a split diff of these. */
function rowsLayout(rows: number, stripHeight: number, boxOf: (line: ChangedLine) => LineBox | undefined = ({ lineNumber }) => ({ top: (lineNumber - 1) * ROW, height: ROW })): ChangeMapLayout {
  return { boxOf, lineCounts: { deletions: rows, additions: rows }, contentHeight: rows * ROW, stripHeight };
}

describe('showsChangeMap', () => {
  const tall = { contentHeight: 4000, viewHeight: 500 };

  it('shows for a diff of two versions with changes that scrolls', () => {
    expect(showsChangeMap({ changes: 3, bothSides: true, ...tall })).toBe(true);
  });

  it('hides with no changes', () => {
    expect(showsChangeMap({ changes: 0, bothSides: true, ...tall })).toBe(false);
  });

  it('hides for a version shown alone, an added or deleted file', () => {
    expect(showsChangeMap({ changes: 1, bothSides: false, ...tall })).toBe(false);
  });

  it('hides when the diff fits without scrolling', () => {
    expect(showsChangeMap({ changes: 3, bothSides: true, contentHeight: 500, viewHeight: 500 })).toBe(false);
    expect(showsChangeMap({ changes: 3, bothSides: true, contentHeight: 501, viewHeight: 500 })).toBe(false);
  });

  it('hides before the view has a size', () => {
    expect(showsChangeMap({ changes: 3, bothSides: true, contentHeight: 4000, viewHeight: 0 })).toBe(false);
  });
});

describe('changeKindOf', () => {
  it('names a change by the lines it has', () => {
    expect(changeKindOf(region(0, added(4), added(5)))).toBe('added');
    expect(changeKindOf(region(0, removed(4)))).toBe('deleted');
    expect(changeKindOf(region(0, removed(4), added(4)))).toBe('both');
  });
});

/**
 * Pierre's split layout of a diff with its unchanged lines collapsed: each hunk's rows (as many as its longer side),
 * a bar for the lines folded between hunks. A line's row is its offset in its side of the hunk.
 */
function collapsedLayout(original: string, modified: string, stripHeight: number): ChangeMapLayout {
  const BAR = 30;
  const { hunks } = parseDiffFromFile({ name: 'a.ts', contents: original }, { name: 'a.ts', contents: modified });
  const tops: number[] = [];
  let top = 0;
  for (const hunk of hunks) {
    top += BAR;
    tops.push(top);
    top += Math.max(hunk.additionCount, hunk.deletionCount) * ROW;
  }
  const boxOf = ({ side, lineNumber }: ChangedLine): LineBox | undefined => {
    const index = hunks.findIndex((hunk) => {
      const [start, count] = side === 'additions' ? [hunk.additionStart, hunk.additionCount] : [hunk.deletionStart, hunk.deletionCount];
      return lineNumber >= start && lineNumber < start + count;
    });
    if (index === -1) return undefined;
    const hunk = hunks[index]!;
    const start = side === 'additions' ? hunk.additionStart : hunk.deletionStart;
    return { top: tops[index]! + (lineNumber - start) * ROW, height: ROW };
  };
  return { boxOf, lineCounts: { deletions: 1500, additions: 1500 }, contentHeight: top + BAR, stripHeight };
}

/** A long file with its changes spread through it, as `scripts/sandboxes` would build one: groups far apart, and a run of close one-line edits. */
function spreadChanges(): { original: string; modified: string } {
  const original = numbered(1500);
  const modified: string[] = [];
  original.forEach((line, index) => {
    const number = index + 1;
    if (number >= 40 && number <= 42) return void modified.push(`${line} changed`);
    if (number === 300) return void modified.push(line, 'added', 'added too');
    if (number >= 610 && number <= 619) return;
    if (number >= 1200 && number <= 1260 && number % 3 === 0) return void modified.push(`${line} edited`);
    if (number === 1450) return;
    modified.push(line);
  });
  return { original: text(original), modified: text(modified) };
}

describe('changeMarks', () => {
  it('marks each change as a block at its share of the content, by what it does', () => {
    const original = numbered(100);
    const modified = [...original];
    modified[9] = 'changed 10';
    modified.splice(60, 0, 'inserted', 'inserted too');
    const regions = regionsOf(text(original), text(modified));
    expect(changeMarks(regions, rowsLayout(102, 510))).toEqual([
      { top: 45, height: 5, kind: 'both', first: 0, last: 0 },
      { top: 300, height: 10, kind: 'added', first: 1, last: 1 },
    ]);
  });

  it('marks a removed line as a block, never shorter than the minimum', () => {
    const original = numbered(1000);
    const modified = original.filter((_, index) => index !== 499);
    const [change] = regionsOf(text(original), text(modified));
    expect(changeMarks([change!], rowsLayout(1000, 500))).toEqual([{ top: 249, height: MIN_MARK_HEIGHT, kind: 'deleted', first: 0, last: 0 }]);
  });

  it('keeps changes far apart in the file as blocks of their own, unchanged lines collapsed between them', () => {
    const { original, modified } = spreadChanges();
    const marks = changeMarks(regionsOf(original, modified), collapsedLayout(original, modified, 725));
    expect(marks.map(({ kind, first, last }) => ({ kind, first, last }))).toEqual([
      { kind: 'both', first: 0, last: 0 },
      { kind: 'added', first: 1, last: 1 },
      { kind: 'deleted', first: 2, last: 2 },
      { kind: 'both', first: 3, last: 23 },
      { kind: 'deleted', first: 24, last: 24 },
    ]);
    expect(marks.every((mark, index) => index === 0 || mark.top >= marks[index - 1]!.top + marks[index - 1]!.height + FUSE_GAP)).toBe(true);
  });

  it('fuses changes a few unchanged lines apart into one band, however far apart the diff lays them out', () => {
    const regions = [region(0, removed(10), added(10)), region(1, added(14)), region(2, added(18 + FUSE_LINES))];
    const tall = (line: ChangedLine): LineBox => ({ top: (line.lineNumber - 1) * 100, height: 100 });
    expect(changeMarks(regions, { ...rowsLayout(100, 1000, tall), contentHeight: 10_000 })).toEqual([
      { top: 90, height: 50, kind: 'both', first: 0, last: 1 },
      { top: 200, height: 10, kind: 'added', first: 2, last: 2 },
    ]);
  });

  it('fuses blocks closer than the gap the eye can read, of one kind when all are', () => {
    const marks = changeMarks([region(0, added(10)), region(1, added(20)), region(2, removed(30)), region(3, added(900))], rowsLayout(1000, 200));
    expect(marks.map(({ kind, first, last }) => ({ kind, first, last }))).toEqual([
      { kind: 'both', first: 0, last: 2 },
      { kind: 'added', first: 3, last: 3 },
    ]);
  });

  it('places changes where the diff lays them out, wrapped lines at their whole height', () => {
    const wrapped = (line: ChangedLine): LineBox => (line.lineNumber === 50 ? { top: 49 * ROW, height: 10 * ROW } : { top: (line.lineNumber - 1) * ROW + (line.lineNumber > 50 ? 9 * ROW : 0), height: ROW });
    const layout = { ...rowsLayout(100, 109, wrapped), contentHeight: 109 * ROW };
    expect(changeMarks([region(0, removed(50), added(50))], layout)).toEqual([{ top: 49, height: 10, kind: 'both', first: 0, last: 0 }]);
  });

  it('spans the removed lines then the added ones of a change shown unified', () => {
    const unified = (line: ChangedLine): LineBox => ({ top: (line.side === 'deletions' ? line.lineNumber - 1 : line.lineNumber + 1) * ROW, height: ROW });
    expect(changeMarks([region(0, removed(10), removed(11), added(10))], rowsLayout(100, 100, unified))).toEqual([{ top: 9, height: MIN_MARK_HEIGHT, kind: 'both', first: 0, last: 0 }]);
  });

  it("places a change at its line's share of its side while the diff can't tell", () => {
    const layout = { ...rowsLayout(100, 200, () => undefined), lineCounts: { deletions: 100, additions: 200 }, contentHeight: 4000 };
    expect(changeMarks([region(0, added(101))], layout)).toEqual([{ top: 100, height: MIN_MARK_HEIGHT, kind: 'added', first: 0, last: 0 }]);
  });

  it('keeps a change at the end of the content inside the track', () => {
    expect(changeMarks([region(0, added(100))], rowsLayout(100, 100))).toEqual([{ top: 96, height: MIN_MARK_HEIGHT, kind: 'added', first: 0, last: 0 }]);
  });

  it('draws a bounded number of marks for thousands of changes, asking for at most four lines each', () => {
    const regions = Array.from({ length: 5000 }, (_, index) => region(index, removed(index * 8 + 1), removed(index * 8 + 2), added(index * 8 + 1), added(index * 8 + 2)));
    const layout = rowsLayout(40_000, 600);
    const { result: marks, calls } = countCalls(layout, 'boxOf', () => changeMarks(regions, layout));
    expect(calls).toBe(4 * 5000);
    expect(marks.length).toBeLessThanOrEqual(600 / MIN_MARK_HEIGHT);
    expect(marks[0]!.first).toBe(0);
    expect(marks.at(-1)!.last).toBe(4999);
  });

  it('draws nothing before the view or the content has a size', () => {
    expect(changeMarks([region(0, added(1))], { ...rowsLayout(10, 0) })).toEqual([]);
    expect(changeMarks([region(0, added(1))], { ...rowsLayout(10, 100), contentHeight: 0 })).toEqual([]);
  });
});

describe('scrollTopForTrackPoint', () => {
  const sizes = { contentHeight: 10_000, stripHeight: 500, viewHeight: 400 };

  it('scrolls the view to center the point clicked, on a block or between blocks alike', () => {
    expect(scrollTopForTrackPoint(100, sizes)).toBe(1800);
    expect(scrollTopForTrackPoint(250, sizes)).toBe(4800);
  });

  it('scrolls no further than the ends', () => {
    expect(scrollTopForTrackPoint(1, sizes)).toBe(0);
    expect(scrollTopForTrackPoint(499, sizes)).toBe(9600);
  });

  it('stays at the top before the track has a size', () => {
    expect(scrollTopForTrackPoint(10, { ...sizes, stripHeight: 0 })).toBe(0);
  });
});

describe('changeMarkLabel', () => {
  it('names the change a mark stands for, or the changes it joins', () => {
    expect(changeMarkLabel({ top: 0, height: 4, kind: 'added', first: 2, last: 2 }, 12)).toBe('Change 3 of 12');
    expect(changeMarkLabel({ top: 0, height: 4, kind: 'added', first: 1204, last: 1210 }, 5000)).toBe('Changes 1,205–1,211 of 5,000');
  });
});

describe('placesAgain', () => {
  const regions = [region(0, added(10))];
  const placed: MarksPlacedFrom = { regions, bothSides: true, layoutKey: 'split:true:false', contentHeight: 4000, viewHeight: 500, lastChangeTop: 180 };

  it('places the marks when none were placed yet', () => {
    expect(placesAgain(null, placed)).toBe(true);
  });

  it('places nothing again from the same changes, layout and sizes: scrolling', () => {
    expect(placesAgain(placed, { ...placed })).toBe(false);
  });

  it('places them again for other changes, typed or read anew', () => {
    expect(placesAgain(placed, { ...placed, regions: [region(0, added(10))] })).toBe(true);
  });

  it('places them again when a version shows alone or both show again', () => {
    expect(placesAgain(placed, { ...placed, bothSides: false })).toBe(true);
  });

  it('places them again for another layout: Split or Unified, collapsed, wrapped', () => {
    expect(placesAgain(placed, { ...placed, layoutKey: 'unified:true:false' })).toBe(true);
  });

  it('places them again when the content or the view changes height', () => {
    expect(placesAgain(placed, { ...placed, contentHeight: 4200 })).toBe(true);
    expect(placesAgain(placed, { ...placed, viewHeight: 300 })).toBe(true);
  });

  it("places them again once Pierre can tell where the last change is, and as it measures the lines above it", () => {
    const byShare = { ...placed, lastChangeTop: undefined };
    expect(placesAgain(byShare, placed)).toBe(true);
    expect(placesAgain(placed, { ...placed, lastChangeTop: 240 })).toBe(true);
  });
});
