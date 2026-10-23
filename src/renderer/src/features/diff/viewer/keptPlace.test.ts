import { describe, expect, it } from 'vitest';
import type { FocusedLines } from '../../../app/navigation/pages';
import { keptOffset, linesLayoutOf, notedPlace, placeToRestore, relaysOut, type KeptPlace, type LinesLayout } from './keptPlace';
import type { LineAtTop } from './rowPosition';

const COLLAPSED: LinesLayout = { layout: 'split', collapseUnchanged: true, wrapLines: false };
const ALL_LINES: LinesLayout = { ...COLLAPSED, collapseUnchanged: false };
const NO_OVERRIDES = { wrapsLongLines: false, focusLines: undefined, wholeFile: false, followsLayout: true };
const LINK_LINES: FocusedLines = { side: 'new', first: 40, last: 40 };
// Line 208 at the top, its row below the bar of the 207 lines collapsed above it.
const LINE_208: LineAtTop = { line: { side: 'additions', lineNumber: 208 }, offset: 25, height: 20 };

describe('linesLayoutOf', () => {
  it('draws the lines as the preferences ask', () => {
    expect(linesLayoutOf(COLLAPSED, NO_OVERRIDES)).toEqual(COLLAPSED);
  });

  it('wraps every line of a file with a line too long to draw unwrapped', () => {
    expect(linesLayoutOf(COLLAPSED, { ...NO_OVERRIDES, wrapsLongLines: true }).wrapLines).toBe(true);
  });

  it("shows every line of a file opened on a link's lines", () => {
    expect(linesLayoutOf(COLLAPSED, { ...NO_OVERRIDES, focusLines: LINK_LINES }).collapseUnchanged).toBe(false);
  });

  it('collapses nothing in a file typed into whole: it has no unchanged lines', () => {
    expect(linesLayoutOf(COLLAPSED, { ...NO_OVERRIDES, wholeFile: true }).collapseUnchanged).toBe(false);
  });

  it('lays a version shown alone out the same, split or unified', () => {
    const alone = { ...NO_OVERRIDES, followsLayout: false };
    expect(linesLayoutOf(COLLAPSED, alone)).toEqual(linesLayoutOf({ ...COLLAPSED, layout: 'unified' }, alone));
  });
});

describe('relaysOut', () => {
  it('lays the lines out anew when unchanged lines collapse or unfold, split turns unified, or lines wrap', () => {
    expect(relaysOut(COLLAPSED, ALL_LINES)).toBe(true);
    expect(relaysOut(COLLAPSED, { ...COLLAPSED, layout: 'unified' })).toBe(true);
    expect(relaysOut(COLLAPSED, { ...COLLAPSED, wrapLines: true })).toBe(true);
  });

  it('leaves them as they are when nothing they are drawn from changed', () => {
    expect(relaysOut(COLLAPSED, { ...COLLAPSED })).toBe(false);
  });
});

describe('notedPlace', () => {
  const read = () => LINE_208;

  it('notes the line at the top for the layout coming', () => {
    expect(notedPlace(null, COLLAPSED, ALL_LINES, read)).toEqual({ place: LINE_208, for: ALL_LINES });
  });

  it('notes nothing for a preference that leaves the lines as they are (the comparison method, an image mode)', () => {
    expect(notedPlace(null, COLLAPSED, COLLAPSED, read)).toBeNull();
  });

  it('notes nothing when a long line already wraps them and wrapping is turned on', () => {
    const forced = { ...NO_OVERRIDES, wrapsLongLines: true };
    const before = linesLayoutOf(COLLAPSED, forced);
    const after = linesLayoutOf({ ...COLLAPSED, wrapLines: true }, forced);
    expect(notedPlace(null, before, after, read)).toBeNull();
  });

  it("notes nothing when collapsing a file a link's lines unfold", () => {
    const link = { ...NO_OVERRIDES, focusLines: LINK_LINES };
    expect(notedPlace(null, linesLayoutOf(ALL_LINES, link), linesLayoutOf(COLLAPSED, link), read)).toBeNull();
  });

  it('keeps what was noted through a preference that leaves the lines as they are', () => {
    const kept: KeptPlace = { place: LINE_208, for: ALL_LINES };
    expect(notedPlace(kept, ALL_LINES, ALL_LINES, () => null)).toBe(kept);
  });

  it('notes the place afresh when switched back before the diff drew again', () => {
    const first = notedPlace(null, COLLAPSED, ALL_LINES, read);
    expect(notedPlace(first, ALL_LINES, COLLAPSED, read)).toEqual({ place: LINE_208, for: COLLAPSED });
  });

  it('notes nothing with no line in view (the diff not drawn yet)', () => {
    expect(notedPlace(null, COLLAPSED, ALL_LINES, () => null)).toBeNull();
  });

  it('drops a place kept for another layout when no line is in view to note', () => {
    const kept: KeptPlace = { place: LINE_208, for: ALL_LINES };
    expect(notedPlace(kept, ALL_LINES, COLLAPSED, () => null)).toBeNull();
  });

  it('notes nothing when collapsing or switching the layout of a file typed into whole', () => {
    const whole = { ...NO_OVERRIDES, wholeFile: true, followsLayout: false };
    expect(notedPlace(null, linesLayoutOf(COLLAPSED, whole), linesLayoutOf(ALL_LINES, whole), read)).toBeNull();
    expect(notedPlace(null, linesLayoutOf(COLLAPSED, whole), linesLayoutOf({ ...COLLAPSED, layout: 'unified' }, whole), read)).toBeNull();
  });

  it('notes the place when wrapping a file typed into whole', () => {
    const whole = { ...NO_OVERRIDES, wholeFile: true, followsLayout: false };
    expect(notedPlace(null, linesLayoutOf(COLLAPSED, whole), linesLayoutOf({ ...COLLAPSED, wrapLines: true }, whole), read)).not.toBeNull();
  });
});

describe('placeToRestore', () => {
  const kept: KeptPlace = { place: LINE_208, for: ALL_LINES };

  it('puts back the place kept once the lines are drawn as it was noted for', () => {
    expect(placeToRestore(kept, ALL_LINES)).toBe(LINE_208);
  });

  it('puts back nothing kept for another layout, nor with nothing kept', () => {
    expect(placeToRestore(kept, COLLAPSED)).toBeNull();
    expect(placeToRestore(null, ALL_LINES)).toBeNull();
  });
});

describe('keptOffset', () => {
  it('puts a row that started in view where it stood, whatever its height now', () => {
    expect(keptOffset(LINE_208, 20)).toBe(25);
    expect(keptOffset(LINE_208, 200)).toBe(25);
    expect(keptOffset({ ...LINE_208, offset: 0 }, 60)).toBe(0);
  });

  it('keeps as much of a row partly scrolled past scrolled past, wrapped or unwrapped', () => {
    // Halfway through a line wrapped to ten rows, unwrapped to one: halfway through that one.
    expect(keptOffset({ ...LINE_208, offset: -100, height: 200 }, 20)).toBe(-10);
    // Halfway through a line one row high, wrapped to ten.
    expect(keptOffset({ ...LINE_208, offset: -10, height: 20 }, 200)).toBe(-100);
  });

  it('keeps the offset of a row it had no height for', () => {
    expect(keptOffset({ ...LINE_208, offset: -5, height: 0 }, 20)).toBe(-5);
  });
});
