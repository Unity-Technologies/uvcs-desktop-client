import { describe, expect, it } from 'vitest';
import { collapsesUnchanged, initialSelectedRange, linesSelectable, publishedSelection, shownSelection } from './lineLinkMode';

const LINES = { side: 'new', first: 4, last: 6 } as const;
const RANGE = { start: 4, side: 'additions', end: 6, endSide: 'additions' } as const;

describe('linesSelectable', () => {
  it('selects lines in a read-only diff, never where the gutter picks lines to discard or the text is typed into', () => {
    expect(linesSelectable({ discards: false, editable: false })).toBe(true);
    expect(linesSelectable({ discards: true, editable: false })).toBe(false);
    expect(linesSelectable({ discards: false, editable: true })).toBe(false);
  });
});

describe('collapsesUnchanged', () => {
  it('folds unchanged lines as the user prefers, except in a file a link opened on', () => {
    expect(collapsesUnchanged(true, undefined)).toBe(true);
    expect(collapsesUnchanged(true, LINES)).toBe(false);
    expect(collapsesUnchanged(false, undefined)).toBe(false);
  });
});

describe('shownSelection', () => {
  it("shows the discard pick where the diff offers discards, even none picked, else the link's selection", () => {
    expect(shownSelection(RANGE, null)).toBe(RANGE);
    expect(shownSelection(null, RANGE)).toBeNull();
    expect(shownSelection(undefined, RANGE)).toBe(RANGE);
    expect(shownSelection(undefined, undefined)).toBeUndefined();
  });
});

describe('initialSelectedRange', () => {
  it("selects a link's lines as the view opens, where lines can be selected", () => {
    expect(initialSelectedRange(true, LINES)).toEqual(RANGE);
    expect(initialSelectedRange(false, LINES)).toBeNull();
    expect(initialSelectedRange(true, undefined)).toBeNull();
  });
});

describe('publishedSelection', () => {
  it('publishes the lines selected in the file, or that none are, only where the place publishes them', () => {
    expect(publishedSelection(true, 'a.cs', RANGE)).toEqual({ path: 'a.cs', lines: LINES });
    expect(publishedSelection(true, 'a.cs', null)).toBeNull();
    expect(publishedSelection(false, 'a.cs', RANGE)).toBeUndefined();
  });
});
