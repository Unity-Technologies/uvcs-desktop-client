import { describe, expect, it } from 'vitest';
import { suggestionFileDiff } from './suggestionFileDiff';

const ONE_LINE = { replacedText: '    public int frameRate = 30;\n', suggestedText: '    public int frameRate = 60;\n', firstLine: 12 };

describe('suggestionFileDiff', () => {
  it("is both texts in one hunk numbered from the commented line, the line removed and the suggested one added, in the file's language", () => {
    const diff = suggestionFileDiff('Assets/Scripts/Settings.cs', ONE_LINE, 'diff');
    expect(diff.lang).toBe('csharp');
    expect(diff.deletionLines).toEqual(['    public int frameRate = 30;\n']);
    expect(diff.additionLines).toEqual(['    public int frameRate = 60;\n']);
    expect(diff.hunks).toHaveLength(1);
    expect(diff.hunks[0]).toMatchObject({ deletionStart: 12, deletionLines: 1, additionStart: 12, additionLines: 1 });
  });

  it('shows every line replaced, then every line suggested, stacked (`replacedThenSuggested`)', () => {
    const diff = suggestionFileDiff('a.cs', { replacedText: 'keep();\nold();\n', suggestedText: 'keep();\nnew();\n', firstLine: 3 }, 'stacked');
    expect(diff.hunks[0]!.hunkContent.map((part) => [part.type, part.type === 'change' ? part.deletions : 0, part.type === 'change' ? part.additions : 0])).toEqual([['change', 2, 2]]);
  });

  it('shows the lines kept once, between the lines changed, as a diff (`suggestionLineDiff`)', () => {
    const diff = suggestionFileDiff('a.cs', { replacedText: 'keep();\nold();\n', suggestedText: 'keep();\nnew();\n', firstLine: 3 }, 'diff');
    expect(diff.hunks[0]!.hunkContent.map((part) => part.type)).toEqual(['context', 'change']);
  });

  it('diffs a deletion and a suggestion whose replaced lines are unknown as one side alone', () => {
    expect(suggestionFileDiff('a.ts', { replacedText: 'old();\n', suggestedText: '', firstLine: 3 }, 'diff').hunks[0]).toMatchObject({ deletionLines: 1, additionLines: 0 });
    expect(suggestionFileDiff('a.ts', { replacedText: '', suggestedText: 'new();\n', firstLine: 3 }, 'diff').hunks[0]).toMatchObject({ deletionLines: 0, additionLines: 1 });
  });

  it("shows a file whose language isn't known, or code past the size a comment's is highlighted to, as plain text", () => {
    expect(suggestionFileDiff('notes.unknownext', ONE_LINE, 'diff').lang).toBe('text');
    expect(suggestionFileDiff('Player.cs', { replacedText: 'x\n', suggestedText: `${'y'.repeat(100_000)}\n`, firstLine: 1 }, 'diff').lang).toBe('text');
  });
});
