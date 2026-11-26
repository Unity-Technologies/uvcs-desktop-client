import { describe, expect, it } from 'vitest';
import { stackedWordMarks, suggestionWordMarks } from './stackedWordMarks';

const text = (...lines: string[]) => lines.map((line) => `${line}\n`).join('');

/** Each side's marked text by line number, as the rows show it. */
function markedText(replaced: string, suggested: string, firstLine: number) {
  const marks = stackedWordMarks(replaced, suggested, firstLine);
  const lines = { deletions: replaced.split('\n'), additions: suggested.split('\n') };
  const side = (name: 'deletions' | 'additions') =>
    [...marks[name]].map(([line, ranges]) => [line, ranges.map(({ start, end }) => lines[name][line - firstLine]!.slice(start, end))]);
  return { deletions: side('deletions'), additions: side('additions') };
}

describe('stackedWordMarks', () => {
  it('marks the words of each line edited against the line it became, though the suggestion adds a line', () => {
    const replaced = text('{', '    var s = A();', '    Undo();', '}');
    const suggested = text('{', '    Shelve s = A();', '    Undo(B);', '    Log();', '}');
    expect(markedText(replaced, suggested, 9)).toEqual({
      deletions: [[10, ['var']], [11, []]],
      additions: [[10, ['Shelve']], [11, ['B']]],
    });
  });

  it('marks nothing on lines kept, added or removed', () => {
    expect(markedText(text('keep();', 'gone();'), text('keep();'), 1)).toEqual({ deletions: [], additions: [] });
    expect(markedText(text('keep();'), text('keep();', 'new();'), 1)).toEqual({ deletions: [], additions: [] });
  });
});

describe('suggestionWordMarks', () => {
  it('marks words over the rows stacked, and none as a diff, where Pierre marks them', () => {
    expect(suggestionWordMarks('stacked', 'a = 1;\n', 'a = 2;\n', 10)).toEqual(stackedWordMarks('a = 1;\n', 'a = 2;\n', 10));
    expect(suggestionWordMarks('diff', 'a = 1;\n', 'a = 2;\n', 10)).toEqual({ deletions: new Map(), additions: new Map() });
  });
});
