import { parseDiffFromFile, type FileDiffMetadata } from '@pierre/diffs';
import { describe, expect, it } from 'vitest';
import { replacedThenSuggested } from './replacedThenSuggested';

function diffOf(replaced: readonly string[], suggested: readonly string[], firstLine = 1): FileDiffMetadata {
  const asFile = (lines: readonly string[]) => lines.map((line) => `${line}\n`).join('');
  return replacedThenSuggested(parseDiffFromFile({ name: 'a.cs', contents: asFile(replaced) }, { name: 'a.cs', contents: asFile(suggested) }), firstLine);
}

/** The rows as the box shows them, top to bottom: `-` removed, `+` added, a space for a line shown unchanged. */
function rowsOf(diff: FileDiffMetadata): string[] {
  const text = (line: string | undefined) => (line ?? '').replace(/\n$/, '');
  return diff.hunks.flatMap((hunk) =>
    hunk.hunkContent.flatMap((part) => {
      if (part.type === 'context') return Array.from({ length: part.lines }, (_, i) => `  ${text(diff.additionLines[part.additionLineIndex + i])}`);
      const removed = Array.from({ length: part.deletions }, (_, i) => `- ${text(diff.deletionLines[part.deletionLineIndex + i])}`);
      const added = Array.from({ length: part.additions }, (_, i) => `+ ${text(diff.additionLines[part.additionLineIndex + i])}`);
      return [...removed, ...added];
    }),
  );
}

/** The removed and added lines Pierre marks the changed words of: the n-th removed and n-th added of one change. */
function wordMarkedPairsOf(diff: FileDiffMetadata): string[][] {
  return diff.hunks.flatMap((hunk) =>
    hunk.hunkContent.flatMap((part) => {
      if (part.type === 'context') return [];
      return Array.from({ length: Math.min(part.deletions, part.additions) }, (_, i) => [
        diff.deletionLines[part.deletionLineIndex + i]!.trim(),
        diff.additionLines[part.additionLineIndex + i]!.trim(),
      ]);
    }),
  );
}

describe('replacedThenSuggested', () => {
  it('reads a line wrapped in a new condition as the line replaced, then the lines suggested', () => {
    const diff = diffOf(['    result |= Show;'], ['    if (!info.IsXlink)', '        result |= Show;']);
    expect(rowsOf(diff)).toEqual(['-     result |= Show;', '+     if (!info.IsXlink)', '+         result |= Show;']);
  });

  it("marks no words when the suggestion's lines don't take the replaced ones' places one for one", () => {
    const diff = diffOf(['    result |= Show;'], ['    if (!info.IsXlink)', '        result |= Show;']);
    expect(wordMarkedPairsOf(diff)).toEqual([]);
  });

  it("leaves Pierre no lines to pair, even on a line edited in place: the words are marked over the rows (`stackedWordMarks`)", () => {
    const diff = diffOf(['    public int frameRate = 30;'], ['    public int frameRate = 60;']);
    expect(rowsOf(diff)).toEqual(['-     public int frameRate = 30;', '+     public int frameRate = 60;']);
    expect(wordMarkedPairsOf(diff)).toEqual([]);
  });

  it('reads a range as all its lines replaced, then all the lines suggested, the lines it keeps among them', () => {
    const diff = diffOf(['x = 1;', 'keep();', 'y = 2;', 'end();'], ['if (ok)', '    x = 1;', 'keep();', 'y = 3;', 'end();', 'done();']);
    expect(rowsOf(diff)).toEqual([
      '- x = 1;', '- keep();', '- y = 2;', '- end();',
      '+ if (ok)', '+     x = 1;', '+ keep();', '+ y = 3;', '+ end();', '+ done();',
    ]);
    expect(wordMarkedPairsOf(diff)).toEqual([]);
  });

  it('stacks a range whose lines are each edited in place, too', () => {
    const diff = diffOf(['a = 1;', 'keep();', 'b = 2;'], ['a = 2;', 'keep();', 'b = 3;']);
    expect(rowsOf(diff)).toEqual(['- a = 1;', '- keep();', '- b = 2;', '+ a = 2;', '+ keep();', '+ b = 3;']);
    expect(wordMarkedPairsOf(diff)).toEqual([]);
  });

  it("numbers both sides from the commented line, as the file's lines", () => {
    const diff = diffOf(['    result |= Show;'], ['    if (!info.IsXlink)', '        result |= Show;'], 273);
    // Never partial: Pierre's FileDiff would ask for the whole files of a partial diff, which a suggestion hasn't.
    expect(diff.isPartial).toBe(false);
    expect(diff.hunks).toHaveLength(1);
    expect(diff.hunks[0]).toMatchObject({ collapsedBefore: 0, deletionStart: 273, deletionCount: 1, additionStart: 273, additionCount: 2 });
  });

  it('shows a deletion as the lines removed alone', () => {
    const diff = diffOf(['old();', 'older();'], [], 40);
    expect(rowsOf(diff)).toEqual(['- old();', '- older();']);
    expect(diff.hunks[0]).toMatchObject({ deletionStart: 40, deletionCount: 2, additionCount: 0 });
  });

  it('counts the rows each layout takes', () => {
    const wrapped = diffOf(['    result |= Show;'], ['    if (!info.IsXlink)', '        result |= Show;']);
    expect(wrapped).toMatchObject({ unifiedLineCount: 3, splitLineCount: 3 });
    expect(wrapped.hunks[0]).toMatchObject({ unifiedLineCount: 3, splitLineCount: 3 });
    const edited = diffOf(['a = 1;', 'b = 2;'], ['a = 2;', 'b = 3;']);
    expect(edited).toMatchObject({ unifiedLineCount: 4, splitLineCount: 4 });
  });
});
