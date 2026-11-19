import { parseDiffFromFile, type FileDiffMetadata } from '@pierre/diffs';
import { describe, expect, it } from 'vitest';
import { replacedThenSuggested } from './replacedThenSuggested';

function diffOf(replaced: readonly string[], suggested: readonly string[]): FileDiffMetadata {
  const asFile = (lines: readonly string[]) => lines.map((line) => `${line}\n`).join('');
  return replacedThenSuggested(parseDiffFromFile({ name: 'a.cs', contents: asFile(replaced) }, { name: 'a.cs', contents: asFile(suggested) }));
}

/** The rows as the box shows them, top to bottom: `-` removed, `+` added, a space for a line the suggestion keeps. */
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

  it('marks no words between a replaced line and a suggested one it was never paired with', () => {
    const diff = diffOf(['    result |= Show;'], ['    if (!info.IsXlink)', '        result |= Show;']);
    expect(wordMarkedPairsOf(diff)).toEqual([]);
  });

  it('keeps the changed words marked on a line edited in place', () => {
    const diff = diffOf(['    public int frameRate = 30;'], ['    public int frameRate = 60;']);
    expect(rowsOf(diff)).toEqual(['-     public int frameRate = 30;', '+     public int frameRate = 60;']);
    expect(wordMarkedPairsOf(diff)).toEqual([['public int frameRate = 30;', 'public int frameRate = 60;']]);
  });

  it('reads each changed part of a range as its lines replaced, then those suggested, around the lines it keeps', () => {
    const diff = diffOf(
      ['x = 1;', 'keep();', 'y = 2;', 'end();'],
      ['if (ok)', '    x = 1;', 'keep();', 'y = 3;', 'end();', 'done();'],
    );
    expect(rowsOf(diff)).toEqual(['- x = 1;', '+ if (ok)', '+     x = 1;', '  keep();', '- y = 2;', '+ y = 3;', '  end();', '+ done();']);
    expect(wordMarkedPairsOf(diff)).toEqual([['y = 2;', 'y = 3;']]);
  });

  it('lays the rows out in the split view as many as each side needs', () => {
    const diff = diffOf(['    result |= Show;'], ['    if (!info.IsXlink)', '        result |= Show;']);
    const splitRows = (parts: FileDiffMetadata['hunks'][number]['hunkContent']) =>
      parts.reduce((rows, part) => rows + (part.type === 'context' ? part.lines : Math.max(part.deletions, part.additions)), 0);
    expect(diff.hunks.map((hunk) => hunk.splitLineCount)).toEqual(diff.hunks.map((hunk) => splitRows(hunk.hunkContent)));
    expect(diff.splitLineCount).toBe(diff.hunks.reduce((rows, hunk) => rows + hunk.splitLineCount, 0));
  });
});
