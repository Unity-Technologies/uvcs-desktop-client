import type { FileDiffMetadata } from '@pierre/diffs';
import { describe, expect, it } from 'vitest';
import { SUGGESTION_CONTEXT_LINES, suggestionLineDiff } from './suggestionLineDiff';

function diffOf(replaced: readonly string[], suggested: readonly string[], firstLine = 1): FileDiffMetadata {
  const asFile = (lines: readonly string[]) => lines.map((line) => `${line}\n`).join('');
  return suggestionLineDiff({ name: 'a.cs', contents: asFile(replaced) }, { name: 'a.cs', contents: asFile(suggested) }, firstLine);
}

/** The rows as the box shows them, top to bottom: `-` removed, `+` added, a space for a line kept. */
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

describe('suggestionLineDiff', () => {
  it('shows the lines a suggestion keeps once, untinted, and only the edited ones removed and added', () => {
    const diff = diffOf(['void Switch()', '{', '    var shelve = Shelve();', '    Undo();', '}'], ['void Switch()', '{', '    Shelve shelve = Shelve();', '    Undo(DontFail);', '    Log();', '}']);
    expect(rowsOf(diff)).toEqual([
      '  void Switch()',
      '  {',
      '-     var shelve = Shelve();',
      '-     Undo();',
      '+     Shelve shelve = Shelve();',
      '+     Undo(DontFail);',
      '+     Log();',
      '  }',
    ]);
    // The rows its place holds while Pierre loads (`SuggestionDiff`).
    expect(diff.unifiedLineCount).toBe(8);
  });

  it('marks the changed words of the lines edited, though the suggestion adds lines too', () => {
    const diff = diffOf(['{', '    var shelve = Shelve();', '}'], ['{', '    Shelve shelve = Shelve();', '    Log();', '}']);
    expect(wordMarkedPairsOf(diff)).toEqual([['var shelve = Shelve();', 'Shelve shelve = Shelve();']]);
  });

  it('reads a line wrapped in a new condition as the code diff reads it', () => {
    const diff = diffOf(['    result |= Show;'], ['    if (!info.IsXlink)', '        result |= Show;']);
    expect(rowsOf(diff)).toEqual(['+     if (!info.IsXlink)', '-     result |= Show;', '+         result |= Show;']);
  });

  it(`splits a long suggestion's changes into hunks of ${SUGGESTION_CONTEXT_LINES} lines kept around each, numbered from the commented line, as the file's lines`, () => {
    const kept = Array.from({ length: 40 }, (_, index) => `line${index};`);
    const diff = diffOf(['first();', ...kept, 'last();'], ['first2();', ...kept, 'last2();'], 273);
    // Never partial: Pierre's FileDiff would ask for the whole files of a partial diff, which a suggestion hasn't.
    expect(diff.isPartial).toBe(false);
    expect(diff.hunks.map(({ collapsedBefore, deletionStart, deletionCount, additionStart, additionCount }) => ({ collapsedBefore, deletionStart, deletionCount, additionStart, additionCount }))).toEqual([
      { collapsedBefore: 0, deletionStart: 273, deletionCount: 4, additionStart: 273, additionCount: 4 },
      { collapsedBefore: 34, deletionStart: 311, deletionCount: 4, additionStart: 311, additionCount: 4 },
    ]);
  });

  it('shows a deletion as the lines removed alone, and lines that can\'t be read as the suggestion added alone', () => {
    const deleted = diffOf(['old();', 'older();'], [], 40);
    expect(rowsOf(deleted)).toEqual(['- old();', '- older();']);
    expect(deleted.hunks[0]).toMatchObject({ deletionStart: 40, deletionCount: 2, additionStart: 39, additionCount: 0 });
    const unread = diffOf([], ['new();'], 40);
    expect(rowsOf(unread)).toEqual(['+ new();']);
    expect(unread.hunks[0]).toMatchObject({ deletionStart: 39, deletionCount: 0, additionStart: 40 });
  });
});
