import { describe, expect, it } from 'vitest';
import { snippetOf } from './outdatedSnippet';

const TEXT = ['one', 'two', 'three', 'four', 'five', 'six'].join('\r\n');

describe('snippetOf', () => {
  it('shows the line commented on with two lines each side, without their line breaks', () => {
    expect(snippetOf(TEXT, 3)).toEqual([
      { number: 1, text: 'one', commented: false },
      { number: 2, text: 'two', commented: false },
      { number: 3, text: 'three', commented: true },
      { number: 4, text: 'four', commented: false },
      { number: 5, text: 'five', commented: false },
    ]);
  });

  it("stays within the file's first and last lines", () => {
    expect(snippetOf(TEXT, 1).map((line) => line.number)).toEqual([1, 2, 3]);
    expect(snippetOf(TEXT, 6).map((line) => line.number)).toEqual([4, 5, 6]);
  });

  it('shows nothing for a line the version never had', () => {
    expect(snippetOf(TEXT, 7)).toEqual([]);
    expect(snippetOf('', 1)).toEqual([]);
  });
});
