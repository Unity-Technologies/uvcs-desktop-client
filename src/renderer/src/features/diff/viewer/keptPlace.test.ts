import { describe, expect, it } from 'vitest';
import type { FocusedLines } from '../../../app/navigation/pages';
import { linesLayoutOf, lineOfRow, notedPlace, placeToRestore, relaysOut, scrollTopFor, type KeptPlace, type LineAtTop, type LinesLayout } from './keptPlace';

const COLLAPSED: LinesLayout = { layout: 'split', collapseUnchanged: true, wrapLines: false };
const ALL_LINES: LinesLayout = { ...COLLAPSED, collapseUnchanged: false };
const NO_OVERRIDES = { wrapsLongLines: false, focusLines: undefined };
const LINK_LINES: FocusedLines = { side: 'new', first: 40, last: 40 };
// Line 208 at the top, its row below the bar of the 207 lines collapsed above it.
const LINE_208: LineAtTop = { line: { side: 'additions', lineNumber: 208 }, offset: 25 };

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

describe('lineOfRow', () => {
  it('reads an added or unchanged line on the modified side', () => {
    expect(lineOfRow('208', 'context')).toEqual({ side: 'additions', lineNumber: 208 });
    expect(lineOfRow('212', 'change-addition')).toEqual({ side: 'additions', lineNumber: 212 });
  });

  it("reads a removed line on the original's side, by its own number", () => {
    expect(lineOfRow('212', 'change-deletion')).toEqual({ side: 'deletions', lineNumber: 212 });
  });

  it('reads no line from what stands for none: a bar of collapsed lines, a gap', () => {
    expect(lineOfRow(undefined, undefined)).toBeNull();
    expect(lineOfRow('', 'context')).toBeNull();
    expect(lineOfRow('0', 'context')).toBeNull();
    expect(lineOfRow('abc', 'context')).toBeNull();
  });
});

describe('scrollTopFor', () => {
  it('puts the line where its row stood from the top of the view', () => {
    expect(scrollTopFor(4160, 25)).toBe(4135);
    expect(scrollTopFor(4160, -8)).toBe(4168);
  });

  it('never scrolls above the top of the file', () => {
    expect(scrollTopFor(10, 25)).toBe(0);
  });
});
