import { describe, expect, it } from 'vitest';
import { linesToReveal, MARKER_ROOM, markerLeft, markerRoom, markerRoomCss, rowsKey } from './diffAnnotations';

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

describe('markerRoom and markerLeft', () => {
  it('keeps a strip at the end of each pane for the markers, so they never draw over code: only while there are any', () => {
    expect(markerRoom(0)).toBe(0);
    expect(markerRoom(3)).toBe(MARKER_ROOM);
  });

  it("puts a marker's right edge in that strip, past the pane's code", () => {
    const codeRight = 600;
    expect(markerLeft(codeRight)).toBeGreaterThan(codeRight);
    expect(markerLeft(codeRight)).toBeLessThanOrEqual(codeRight + MARKER_ROOM);
  });
});

describe('markerRoomCss', () => {
  it('ends the code early only in the panes holding markers, side by side; in the one pane of a unified diff', () => {
    expect(markerRoomCss([{ side: 'additions' }, { side: 'additions' }], 'split')).toBe(`[data-code][data-additions]{margin-inline-end:${MARKER_ROOM}px}`);
    expect(markerRoomCss([{ side: 'deletions' }, { side: 'additions' }], 'split')).toBe(`[data-code][data-deletions]{margin-inline-end:${MARKER_ROOM}px}\n[data-code][data-additions]{margin-inline-end:${MARKER_ROOM}px}`);
    expect(markerRoomCss([{ side: 'deletions' }], 'unified')).toBe(`[data-code]{margin-inline-end:${MARKER_ROOM}px}`);
    expect(markerRoomCss([], 'split')).toBe('');
  });
});
