import { parseDiffFromFile } from '@pierre/diffs';
import { describe, expect, it } from 'vitest';
import { countCalls } from '@shared/testing/countCalls';
import { listChangeBlocks, listChangeRegions, type ChangedLine, type ChangeRegion } from './changeBlocks';
import { changeKindOf, changeMapClick, changeMarkLabel, changeMarks, holdsChange, MIN_MARK_HEIGHT, showsChangeMap, type ChangeMapLayout, type LineBox } from './changeMarks';

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
    expect(changeKindOf(region(0, removed(4), added(4)))).toBe('changed');
  });
});

describe('changeMarks', () => {
  it('marks each change at its share of the content, colored by what it does', () => {
    const original = numbered(100);
    const modified = [...original];
    modified[9] = 'changed 10';
    modified.splice(60, 0, 'inserted', 'inserted too');
    const regions = regionsOf(text(original), text(modified));
    expect(changeMarks(regions, rowsLayout(102, 510))).toEqual([
      { top: 45, height: 5, kind: 'changed', first: 0, last: 0 },
      { top: 300, height: 10, kind: 'added', first: 1, last: 1 },
    ]);
  });

  it('marks a removed line as a thin tick, never thinner than the minimum', () => {
    const original = numbered(1000);
    const modified = original.filter((_, index) => index !== 499);
    const [change] = regionsOf(text(original), text(modified));
    expect(changeMarks([change!], rowsLayout(1000, 500))).toEqual([{ top: 249, height: MIN_MARK_HEIGHT, kind: 'deleted', first: 0, last: 0 }]);
  });

  it('places changes where the diff lays them out, unchanged lines collapsed between them', () => {
    // Lines 1 to 10 are a hunk at the top, a bar stands for lines 11 to 989, and lines 990 to 1000 follow it.
    const collapsed = (line: ChangedLine): LineBox => ({ top: line.lineNumber <= 10 ? (line.lineNumber - 1) * ROW : 10 * ROW + 30 + (line.lineNumber - 990) * ROW, height: ROW });
    const layout = { ...rowsLayout(1000, 460, collapsed), contentHeight: 21 * ROW + 30 + 10 };
    const marks = changeMarks([region(0, added(5)), region(1, added(995))], layout);
    // By line share, line 995 would sit at the very bottom and line 5 at the top; laid out, each is where its row is.
    expect(marks.map(({ top }) => top)).toEqual([80, 330]);
  });

  it('takes a wrapped line at its whole height', () => {
    const wrapped = (line: ChangedLine): LineBox => (line.lineNumber === 50 ? { top: 49 * ROW, height: 10 * ROW } : { top: (line.lineNumber - 1) * ROW + (line.lineNumber > 50 ? 9 * ROW : 0), height: ROW });
    const layout = { ...rowsLayout(100, 109, wrapped), contentHeight: 109 * ROW };
    expect(changeMarks([region(0, removed(50), added(50))], layout)).toEqual([{ top: 49, height: 10, kind: 'changed', first: 0, last: 0 }]);
  });

  it('spans both sides of a change side by side, where the added lines go lower', () => {
    const split = (line: ChangedLine): LineBox => ({ top: (line.lineNumber - 1) * ROW, height: ROW });
    expect(changeMarks([region(0, removed(10), added(10), added(11), added(12), added(13))], rowsLayout(100, 100, split))).toEqual([
      { top: 9, height: 4, kind: 'changed', first: 0, last: 0 },
    ]);
  });

  it('spans the removed lines then the added ones of a change shown unified', () => {
    // Unified: removed lines 10 and 11 are rows 10 and 11, the added line 10 comes under them, as row 12.
    const unified = (line: ChangedLine): LineBox => ({ top: (line.side === 'deletions' ? line.lineNumber - 1 : line.lineNumber + 1) * ROW, height: ROW });
    expect(changeMarks([region(0, removed(10), removed(11), added(10))], rowsLayout(100, 100, unified))).toEqual([
      { top: 9, height: 3, kind: 'changed', first: 0, last: 0 },
    ]);
  });

  it("places a change at its line's share of its side while the diff can't tell", () => {
    const layout = { ...rowsLayout(100, 200, () => undefined), lineCounts: { deletions: 100, additions: 200 }, contentHeight: 4000 };
    expect(changeMarks([region(0, added(101))], layout)).toEqual([{ top: 100, height: MIN_MARK_HEIGHT, kind: 'added', first: 0, last: 0 }]);
  });

  it('keeps a change at the end of the content inside the strip', () => {
    expect(changeMarks([region(0, added(100))], rowsLayout(100, 100))).toEqual([{ top: 97, height: MIN_MARK_HEIGHT, kind: 'added', first: 0, last: 0 }]);
  });

  it('joins changes too close to tell apart into one mark, changed where they differ', () => {
    const marks = changeMarks([region(0, added(10)), region(1, removed(12)), region(2, added(80))], rowsLayout(1000, 100));
    expect(marks).toEqual([
      { top: 0, height: 4, kind: 'changed', first: 0, last: 1 },
      { top: 7, height: 3, kind: 'added', first: 2, last: 2 },
    ]);
  });

  it('draws a bounded number of marks for thousands of changes, asking for at most four lines each', () => {
    const regions = Array.from({ length: 5000 }, (_, index) => region(index, removed(index * 4 + 1), removed(index * 4 + 2), added(index * 4 + 1), added(index * 4 + 2)));
    const layout = rowsLayout(20_000, 600);
    const { result: marks, calls } = countCalls(layout, 'boxOf', () => changeMarks(regions, layout));
    expect(calls).toBe(4 * 5000);
    expect(marks.length).toBeLessThanOrEqual(600 / MIN_MARK_HEIGHT);
    expect(marks[0]!.first).toBe(0);
    expect(marks.at(-1)!.last).toBe(4999);
    // No two marks overlap.
    expect(marks.every((mark, index) => index === 0 || mark.top >= marks[index - 1]!.top + marks[index - 1]!.height)).toBe(true);
  });

  it('draws nothing before the view or the content has a size', () => {
    expect(changeMarks([region(0, added(1))], { ...rowsLayout(10, 0) })).toEqual([]);
    expect(changeMarks([region(0, added(1))], { ...rowsLayout(10, 100), contentHeight: 0 })).toEqual([]);
  });
});

describe('changeMapClick', () => {
  const marks = [
    { top: 40, height: 3, kind: 'added' as const, first: 0, last: 0 },
    { top: 200, height: 10, kind: 'changed' as const, first: 1, last: 3 },
  ];
  const sizes = { contentHeight: 10_000, stripHeight: 500, viewHeight: 400 };

  it('goes to the change of the mark clicked', () => {
    expect(changeMapClick(marks, 41, sizes)).toEqual({ to: 'change', index: 0 });
  });

  it('goes to the first of the changes a mark joins', () => {
    expect(changeMapClick(marks, 209, sizes)).toEqual({ to: 'change', index: 1 });
  });

  it('takes a click a pixel or two off a thin mark as on it', () => {
    expect(changeMapClick(marks, 38, sizes)).toEqual({ to: 'change', index: 0 });
    expect(changeMapClick(marks, 44, sizes)).toEqual({ to: 'change', index: 0 });
  });

  it('scrolls the view to center the point clicked between marks', () => {
    expect(changeMapClick(marks, 100, sizes)).toEqual({ to: 'point', scrollTop: 1800 });
  });

  it('scrolls no further than the ends', () => {
    expect(changeMapClick(marks, 1, sizes)).toEqual({ to: 'point', scrollTop: 0 });
    expect(changeMapClick(marks, 499, sizes)).toEqual({ to: 'point', scrollTop: 9600 });
  });
});

describe('changeMarkLabel', () => {
  it('names the change a mark stands for, or the changes it joins', () => {
    expect(changeMarkLabel({ top: 0, height: 3, kind: 'added', first: 2, last: 2 }, 12)).toBe('Change 3 of 12');
    expect(changeMarkLabel({ top: 0, height: 3, kind: 'added', first: 1204, last: 1210 }, 5000)).toBe('Changes 1,205–1,211 of 5,000');
  });
});

describe('holdsChange', () => {
  it('tells the mark of the change moved to', () => {
    const mark = { top: 0, height: 3, kind: 'added' as const, first: 2, last: 4 };
    expect(holdsChange(mark, 3)).toBe(true);
    expect(holdsChange(mark, 5)).toBe(false);
    expect(holdsChange(mark, null)).toBe(false);
  });
});
