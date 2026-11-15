import { describe, expect, it } from 'vitest';
import { suggestionFileDiff } from './suggestionFileDiff';

const ONE_LINE = { replacedText: '    public int frameRate = 30;\n', suggestedText: '    public int frameRate = 60;\n' };

describe('suggestionFileDiff', () => {
  it("is the whole of both texts, one hunk with the line removed and the suggested one added, in the file's language", () => {
    const diff = suggestionFileDiff('Assets/Scripts/Settings.cs', ONE_LINE);
    expect(diff.lang).toBe('csharp');
    expect(diff.isPartial).toBe(false);
    expect(diff.deletionLines).toEqual(['    public int frameRate = 30;\n']);
    expect(diff.additionLines).toEqual(['    public int frameRate = 60;\n']);
    expect(diff.hunks).toHaveLength(1);
    expect(diff.hunks[0]).toMatchObject({ deletionLines: 1, additionLines: 1 });
  });

  it('shows a line the suggestion keeps as unchanged, as the diff of the file would', () => {
    const diff = suggestionFileDiff('a.ts', { replacedText: 'keep();\nold();\n', suggestedText: 'keep();\nnew();\n' });
    expect(diff.hunks[0]).toMatchObject({ deletionLines: 1, additionLines: 1 });
    expect(diff.hunks[0]!.hunkContent.map((part) => part.type)).toEqual(['context', 'change']);
  });

  it('diffs a deletion and a suggestion whose replaced lines are unknown as one side alone', () => {
    expect(suggestionFileDiff('a.ts', { replacedText: 'old();\n', suggestedText: '' }).hunks[0]).toMatchObject({ deletionLines: 1, additionLines: 0 });
    expect(suggestionFileDiff('a.ts', { replacedText: '', suggestedText: 'new();\n' }).hunks[0]).toMatchObject({ deletionLines: 0, additionLines: 1 });
  });

  it("shows a file whose language isn't known, or code past the size a comment's is highlighted to, as plain text", () => {
    expect(suggestionFileDiff('notes.unknownext', ONE_LINE).lang).toBe('text');
    expect(suggestionFileDiff('Player.cs', { replacedText: 'x\n', suggestedText: `${'y'.repeat(100_000)}\n` }).lang).toBe('text');
  });
});
