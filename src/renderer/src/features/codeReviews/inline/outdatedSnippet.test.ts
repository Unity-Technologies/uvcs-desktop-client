import { describe, expect, it } from 'vitest';
import { SNIPPET_MAX_COMMENTED, snippetLabel, snippetOf } from './outdatedSnippet';

const TEXT = ['one', 'two', 'three', 'four', 'five', 'six'].join('\r\n');
const line = (number: number) => ({ firstLine: number, lastLine: number });

describe('snippetOf', () => {
  it('shows the line commented on with two lines each side, without their line breaks', () => {
    expect(snippetOf(TEXT, line(3))).toEqual([
      { number: 1, text: 'one', commented: false },
      { number: 2, text: 'two', commented: false },
      { number: 3, text: 'three', commented: true },
      { number: 4, text: 'four', commented: false },
      { number: 5, text: 'five', commented: false },
    ]);
  });

  it('marks every line of a range, with the lines around it', () => {
    expect(snippetOf(TEXT, { firstLine: 3, lastLine: 4 }, 1).map(({ number, commented }) => [number, commented])).toEqual([
      [2, false],
      [3, true],
      [4, true],
      [5, false],
    ]);
  });

  it('shows the first lines of a long range, with nothing after them', () => {
    const long = Array.from({ length: 40 }, (_, index) => `line ${index + 1}`).join('\n');
    const shown = snippetOf(long, { firstLine: 5, lastLine: 30 });
    expect(shown.map((snippetLine) => snippetLine.number)).toEqual(Array.from({ length: SNIPPET_MAX_COMMENTED + 2 }, (_, index) => index + 3));
    expect(shown.at(-1)).toEqual({ number: 4 + SNIPPET_MAX_COMMENTED, text: `line ${4 + SNIPPET_MAX_COMMENTED}`, commented: true });
  });

  it("stays within the file's first and last lines", () => {
    expect(snippetOf(TEXT, line(1)).map((snippetLine) => snippetLine.number)).toEqual([1, 2, 3]);
    expect(snippetOf(TEXT, line(6)).map((snippetLine) => snippetLine.number)).toEqual([4, 5, 6]);
    expect(snippetOf(TEXT, { firstLine: 5, lastLine: 9 }).map((snippetLine) => snippetLine.number)).toEqual([3, 4, 5, 6]);
  });

  it('shows nothing for a line the version never had', () => {
    expect(snippetOf(TEXT, line(7))).toEqual([]);
    expect(snippetOf('', line(1))).toEqual([]);
  });
});

describe('snippetLabel', () => {
  it('says which lines were commented on', () => {
    expect(snippetLabel(line(12))).toBe('Line 12 as it was');
    expect(snippetLabel({ firstLine: 12, lastLine: 18 })).toBe('Lines 12–18 as they were');
  });
});
