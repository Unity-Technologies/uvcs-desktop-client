import { describe, expect, it } from 'vitest';
import { contextMenuSelection, copiedLinesWord, lineChipAnchor, lineNumberCellSelector, lineNumberHint, linesText, linesWords, lineUnderPointer, rightClickSelection } from './lineActions';

const range = (start: number, end: number, side: 'additions' | 'deletions' = 'additions') => ({ start, side, end, endSide: side });

describe('lineNumberHint', () => {
  it('says how to select lines, except while a selection is dragged', () => {
    expect(lineNumberHint(false)).toBe('Click to select · Shift+click a range');
    expect(lineNumberHint(true)).toBeNull();
  });
});

describe('lineChipAnchor', () => {
  it('sits by the first line selected, on its side, however the range was dragged', () => {
    expect(lineChipAnchor(range(52, 40), true)).toEqual({ side: 'additions', lineNumber: 40 });
    expect(lineChipAnchor(range(7, 9, 'deletions'), true)).toEqual({ side: 'deletions', lineNumber: 7 });
  });

  it('is none without a selection, or where no link names the lines', () => {
    expect(lineChipAnchor(null, true)).toBeNull();
    expect(lineChipAnchor(range(1, 2), false)).toBeNull();
  });
});

describe('lineNumberCellSelector', () => {
  it("finds a line's number in its pane side by side, its own cell unified, the only one in a file", () => {
    expect(lineNumberCellSelector({ side: 'deletions', lineNumber: 4 }, 'split')).toBe('[data-deletions] [data-column-number="4"]');
    expect(lineNumberCellSelector({ side: 'deletions', lineNumber: 4 }, 'unified')).toBe('[data-column-number="4"][data-line-type="change-deletion"]');
    expect(lineNumberCellSelector({ side: 'additions', lineNumber: 4 }, 'unified')).toBe('[data-column-number="4"]:not([data-line-type="change-deletion"])');
    expect(lineNumberCellSelector({ side: 'additions', lineNumber: 4 }, 'file')).toBe('[data-column-number="4"]');
  });
});

describe('lineUnderPointer', () => {
  it("takes the pane's side side by side, a removed line's older side unified, else the newer side", () => {
    expect(lineUnderPointer({ lineNumber: 3, lineType: 'context', pane: 'deletions' })).toEqual({ side: 'deletions', lineNumber: 3 });
    expect(lineUnderPointer({ lineNumber: 3, lineType: 'change-deletion', pane: null })).toEqual({ side: 'deletions', lineNumber: 3 });
    expect(lineUnderPointer({ lineNumber: 3, lineType: 'context', pane: null })).toEqual({ side: 'additions', lineNumber: 3 });
  });

  it('is none off a line', () => {
    expect(lineUnderPointer({ lineNumber: Number.NaN, lineType: null, pane: null })).toBeNull();
    expect(lineUnderPointer({ lineNumber: 0, lineType: null, pane: null })).toBeNull();
  });
});

describe('rightClickSelection', () => {
  const selected = range(40, 52);

  it('keeps the selection a line inside it is right-clicked on', () => {
    expect(rightClickSelection(selected, { side: 'additions', lineNumber: 45 })).toBe(selected);
  });

  it('selects the line right-clicked outside it, or on the other side, or with nothing selected', () => {
    expect(rightClickSelection(selected, { side: 'additions', lineNumber: 60 })).toEqual(range(60, 60));
    expect(rightClickSelection(selected, { side: 'deletions', lineNumber: 45 })).toEqual(range(45, 45, 'deletions'));
    expect(rightClickSelection(null, { side: 'additions', lineNumber: 3 })).toEqual(range(3, 3));
  });
});

describe('linesText', () => {
  it("copies a side's lines whatever its line breaks", () => {
    expect(linesText('a\r\nb\nc\rd', { side: 'new', first: 2, last: 3 })).toBe('b\nc');
    expect(linesText('a\nb', { side: 'old', first: 2, last: 2 })).toBe('b');
  });
});

describe('linesWords', () => {
  it('names one line or a range', () => {
    expect(linesWords({ side: 'new', first: 42, last: 42 })).toBe('line 42');
    expect(linesWords({ side: 'new', first: 40, last: 52 })).toBe('lines 40–52');
  });
});

describe('contextMenuSelection', () => {
  const line = (lineNumber: number) => ({ side: 'additions', lineNumber }) as const;
  const range = { start: 40, side: 'additions', end: 42, endSide: 'additions' } as const;

  it('keeps the selection when the line clicked is in it, else selects that line', () => {
    expect(contextMenuSelection(range, line(41))).toBe(range);
    expect(contextMenuSelection(range, line(50))).toEqual({ start: 50, side: 'additions', end: 50, endSide: 'additions' });
  });

  it('acts on the selection off any line, and opens no menu with none', () => {
    expect(contextMenuSelection(range, null)).toBe(range);
    expect(contextMenuSelection(null, null)).toBeNull();
  });
});

describe('copiedLinesWord', () => {
  it('names one line or several', () => {
    expect(copiedLinesWord({ side: 'new', first: 3, last: 3 })).toBe('Line');
    expect(copiedLinesWord({ side: 'new', first: 3, last: 5 })).toBe('Lines');
  });
});
