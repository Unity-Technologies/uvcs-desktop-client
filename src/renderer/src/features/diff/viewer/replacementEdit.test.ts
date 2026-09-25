import { describe, expect, it } from 'vitest';
import { replacementEdit, type TextReplacement } from './replacementEdit';

/** Applies the edit the way the editor does: positions count lines and characters before each line break. */
function apply(text: string, { range, newText }: TextReplacement): string {
  const lineStarts = [0, ...[...text.matchAll(/\n/g)].map((match) => match.index + 1)];
  const offset = ({ line, character }: { line: number; character: number }): number => lineStarts[line]! + character;
  return text.slice(0, offset(range.start)) + newText + text.slice(offset(range.end));
}

const cases: [string, string, string][] = [
  ['a line changed in the middle', 'one\ntwo\nthree\n', 'one\n2\nthree\n'],
  ['lines added', 'one\nthree\n', 'one\ntwo\nthree\n'],
  ['lines removed', 'one\ntwo\nthree\n', 'one\nthree\n'],
  ['a line added at the end', 'one\n', 'one\ntwo\n'],
  ['the last line, without a line break', 'one\ntwo', 'one\n2'],
  ['a line break added at the end', 'one\ntwo', 'one\ntwo\n'],
  ['everything', 'one\n', 'two\n'],
  ['from nothing', '', 'one\n'],
  ['to nothing', 'one\ntwo\n', ''],
  ['CRLF lines', 'one\r\ntwo\r\nthree\r\n', 'one\r\n2\r\nthree\r\n'],
  ['repeated lines', 'a\na\na\n', 'a\na\n'],
];

describe('replacementEdit', () => {
  it.each(cases)('turns one text into the other: %s', (_, before, after) => {
    expect(apply(before, replacementEdit(before, after)!)).toBe(after);
  });

  it('replaces only the lines that differ', () => {
    expect(replacementEdit('one\ntwo\nthree\n', 'one\n2\nthree\n')).toEqual({
      range: { start: { line: 1, character: 0 }, end: { line: 2, character: 0 } },
      newText: '2\n',
    });
  });

  it('has nothing to do for equal texts', () => {
    expect(replacementEdit('same\n', 'same\n')).toBeNull();
  });
});
