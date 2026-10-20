import { describe, expect, it } from 'vitest';
import { FLASHED_LINES, flashCss } from '../../diff/viewer/lineMarksCss';
import { ConflictPlace, conflictLinesSelector, conflictsAbove } from './conflictRows';

describe('conflictsAbove', () => {
  it('counts the conflicts starting above the top of the view; one starting at the top is in view', () => {
    const at = (top: number): number => top;
    expect(conflictsAbove([10, 200, 900], at, 0)).toBe(0);
    expect(conflictsAbove([-400, 200, 900], at, 200)).toBe(1);
    expect(conflictsAbove([-400, -20, -1], at, 0)).toBe(3);
    expect(conflictsAbove([], at, 0)).toBe(0);
  });

  it('reads where they start only up to the first in view', () => {
    const read: number[] = [];
    conflictsAbove([-400, 10, 200, 900], (top) => (read.push(top), top), 0);
    expect(read).toEqual([-400, 10]);
  });
});

describe('ConflictPlace', () => {
  /** The surface scrolled to `top`, of the most it can (`max`). */
  const at = (top: number, max = 2000) => ({ top, max });

  it('stands where the screen says, and remembers it for when the conflicts change', () => {
    const place = new ConflictPlace();
    expect(place.above(() => 2, at(0))).toBe(2);
    expect(place.aboveAfterChange(3)).toBe(2);
  });

  it('stands just before a conflict resolved in it, whatever the screen says, and as often as it is asked', () => {
    const place = new ConflictPlace();
    place.resolvedAt(1, 3, at(400));
    expect(place.aboveAfterChange(2)).toBe(1);
    expect(place.aboveAfterChange(2)).toBe(1);
    expect(place.above(() => 0, at(400))).toBe(1);
    place.moved();
    expect(place.above(() => 0, at(400))).toBe(0);
  });

  it('is moved by a drag, not by the re-layout of the shorter text nor a nudge', () => {
    const place = new ConflictPlace();
    place.resolvedAt(2, 3, at(1200, 1200));
    // The text lost the conflict's rows at the end of the file: the surface can't scroll as far.
    expect(place.above(() => 0, at(1000, 1000))).toBe(2);
    expect(place.above(() => 0, at(1030, 1030 + 400))).toBe(2);
    expect(place.above(() => 0, at(300, 1000))).toBe(0);
  });

  it('forgets the conflict resolved once the conflicts change otherwise: started over, saved by a merge tool', () => {
    const place = new ConflictPlace();
    expect(place.above(() => 0, at(0))).toBe(0);
    place.resolvedAt(1, 3, at(0));
    expect(place.aboveAfterChange(2)).toBe(1);
    expect(place.aboveAfterChange(4)).toBe(0);
    expect(place.above(() => 3, at(0))).toBe(3);
  });
});

describe('conflictLinesSelector', () => {
  it("selects a conflict's lines by their index, so both sides light up", () => {
    expect(conflictLinesSelector(['2,2', '3,2'])).toBe('[data-line-index="2,2"],[data-line-index="3,2"]');
    expect(flashCss(conflictLinesSelector(['2,2']), 1)).toContain('[data-line-index="2,2"]{animation:change-flash-1 ');
  });

  it("lights a long conflict's first lines only, as a diff's change", () => {
    const indexes = Array.from({ length: FLASHED_LINES + 50 }, (_, line) => `${line},${line}`);
    expect(conflictLinesSelector(indexes).split(',[').length).toBe(FLASHED_LINES);
  });

  it('lights nothing for a conflict with no lines on screen', () => {
    expect(flashCss(conflictLinesSelector([]), 1)).toBe('');
  });
});
