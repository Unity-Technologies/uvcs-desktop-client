import { describe, expect, it } from 'vitest';
import { lineDiff } from './lineDiff';
import { caretLineCss, followsLayout, shownDiff } from './shownDiff';

const both = { original: true, modified: true };
const diff = (original: string, modified: string, sides = both, typedInto = false) =>
  shownDiff(lineDiff(original, modified, 'recognizeAll', 'agent.cs.meta').meta, sides, original, modified, typedInto);
const markers = (original: string, modified: string, typedInto = false) =>
  diff(original, modified, both, typedInto).hunks.map(({ noEOFCRDeletions, noEOFCRAdditions }) => ({ noEOFCRDeletions, noEOFCRAdditions }));

describe('shownDiff', () => {
  it('keeps both sides of a diff from an empty file', () => {
    const shown = diff('', "Now I'm editing it\n");
    expect(shown.type).toBe('change');
    expect(shown.deletionLines).toEqual([]);
    expect(shown.additionLines).toEqual(["Now I'm editing it\n"]);
  });

  it('keeps both sides of a diff to an empty file', () => {
    const shown = diff('gone\n', '');
    expect(shown.type).toBe('change');
    expect(shown.deletionLines).toEqual(['gone\n']);
  });

  it('shows an added or private item alone, and a deleted one', () => {
    expect(diff('', 'new\n', { original: false, modified: true }).type).toBe('new');
    expect(diff('gone\n', '', { original: true, modified: false }).type).toBe('deleted');
  });

  it('leaves other diffs as Pierre reads them', () => {
    expect(diff('a\n', 'b\n').type).toBe('change');
  });

  it('marks a missing final line break only when the line break changed', () => {
    expect(markers('a\nb\n', 'a\nb')).toEqual([{ noEOFCRDeletions: false, noEOFCRAdditions: true }]);
    expect(markers('', "Now I'm editing it")).toEqual([{ noEOFCRDeletions: false, noEOFCRAdditions: false }]);
    expect(markers('a\nb', 'a\nc')).toEqual([{ noEOFCRDeletions: false, noEOFCRAdditions: false }]);
  });

  it('keeps the markers of a diff typed into, which Pierre works out again at every keystroke (hidden by CSS)', () => {
    expect(markers('a\nb', 'a\nc', true)).toEqual([{ noEOFCRDeletions: true, noEOFCRAdditions: true }]);
  });
});

describe('caretLineCss', () => {
  it("styles the editor's empty last line after a final line break, or of an empty text, as an unchanged line", () => {
    expect(caretLineCss('a\nb\n')).toContain('[data-line="3"]');
    expect(caretLineCss('a\rb\r')).toContain('[data-line="3"]');
    expect(caretLineCss('')).toContain('[data-line="1"]');
  });

  it('has nothing to style when the text ends without a line break: its last line is a line of the file', () => {
    expect(caretLineCss('a\nb')).toBe('');
  });
});

describe('followsLayout', () => {
  it('is true for two versions, one of them empty included', () => {
    expect(followsLayout(both, false)).toBe(true);
  });

  it('is false for one version alone, or a file typed into whole', () => {
    expect(followsLayout({ original: false, modified: true }, false)).toBe(false);
    expect(followsLayout({ original: true, modified: false }, false)).toBe(false);
    expect(followsLayout(both, true)).toBe(false);
  });
});
