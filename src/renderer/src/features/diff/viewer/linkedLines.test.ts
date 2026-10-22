import { describe, expect, it } from 'vitest';
import { linkedLinesOf, selectedRangeOf } from './linkedLines';

describe('selectedRangeOf', () => {
  it("selects a link's lines on the newer side, or the older one's for #old-L", () => {
    expect(selectedRangeOf({ side: 'new', first: 40, last: 52 })).toEqual({ start: 40, side: 'additions', end: 52, endSide: 'additions' });
    expect(selectedRangeOf({ side: 'old', first: 7, last: 7 })).toEqual({ start: 7, side: 'deletions', end: 7, endSide: 'deletions' });
  });
});

describe('linkedLinesOf', () => {
  it('names no lines when none are selected', () => {
    expect(linkedLinesOf(null)).toBeNull();
  });

  it("names a side's lines first to last, however they were picked (upwards with Shift too)", () => {
    expect(linkedLinesOf({ start: 52, side: 'additions', end: 40, endSide: 'additions' })).toEqual({ side: 'new', first: 40, last: 52 });
    expect(linkedLinesOf({ start: 3, side: 'deletions', end: 5 })).toEqual({ side: 'old', first: 3, last: 5 });
    expect(linkedLinesOf({ start: 9, end: 9 })).toEqual({ side: 'new', first: 9, last: 9 });
  });

  it('keeps the newer side’s end of a selection across both sides, as a link names one side', () => {
    expect(linkedLinesOf({ start: 12, side: 'deletions', end: 15, endSide: 'additions' })).toEqual({ side: 'new', first: 15, last: 15 });
    expect(linkedLinesOf({ start: 15, side: 'additions', end: 12, endSide: 'deletions' })).toEqual({ side: 'new', first: 15, last: 15 });
  });

  it('reads back the lines a link selected', () => {
    for (const lines of [{ side: 'new', first: 1, last: 1 }, { side: 'old', first: 4, last: 20 }] as const) {
      expect(linkedLinesOf(selectedRangeOf(lines))).toEqual(lines);
    }
  });
});
