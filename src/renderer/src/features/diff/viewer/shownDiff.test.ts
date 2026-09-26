import { describe, expect, it } from 'vitest';
import { lineDiffOptions } from './comparisonMethod';
import { shownDiff } from './shownDiff';

const file = (contents: string) => ({ name: 'agent.cs.meta', contents });
const diff = (original: string, modified: string) => shownDiff(file(original), file(modified), lineDiffOptions('recognizeAll'));
const markers = (original: string, modified: string) =>
  diff(original, modified).hunks.map(({ noEOFCRDeletions, noEOFCRAdditions }) => ({ noEOFCRDeletions, noEOFCRAdditions }));

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

  it('leaves other diffs as Pierre reads them', () => {
    expect(diff('a\n', 'b\n').type).toBe('change');
  });

  it('marks a missing final line break only when the line break changed', () => {
    expect(markers('a\nb\n', 'a\nb')).toEqual([{ noEOFCRDeletions: false, noEOFCRAdditions: true }]);
    expect(markers('', "Now I'm editing it")).toEqual([{ noEOFCRDeletions: false, noEOFCRAdditions: false }]);
    expect(markers('a\nb', 'a\nc')).toEqual([{ noEOFCRDeletions: false, noEOFCRAdditions: false }]);
  });
});
