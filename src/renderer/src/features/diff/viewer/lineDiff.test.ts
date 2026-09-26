import { describe, expect, it } from 'vitest';
import type { ComparisonMethod } from './comparisonMethod';
import { differsUnder, lineDiff } from './lineDiff';

const stats = (original: string, modified: string, method: ComparisonMethod = 'recognizeAll') => {
  const { added, removed } = lineDiff(original, modified, method);
  return { added, removed };
};

describe('lineDiff counts', () => {
  it('counts nothing for identical texts', () => {
    expect(stats('a\nb\n', 'a\nb\n')).toEqual({ added: 0, removed: 0 });
    expect(stats('', '')).toEqual({ added: 0, removed: 0 });
  });

  it('counts every line of a new file as added, and of a deleted one as removed', () => {
    expect(stats('', 'a\nb\nc\n')).toEqual({ added: 3, removed: 0 });
    expect(stats('a\nb\n', '')).toEqual({ added: 0, removed: 2 });
  });

  it('counts a changed line as one removed and one added, and changes in different places', () => {
    expect(stats('a\nb\nc\n', 'a\nB\nc\n')).toEqual({ added: 1, removed: 1 });
    expect(stats('a\nb\nc\nd\n', 'x\na\nb\nd\ny\n')).toEqual({ added: 2, removed: 1 });
  });

  it('breaks lines at lone CRs too', () => {
    expect(stats('a\rb\rc\r', 'a\rB\rc\r')).toEqual({ added: 1, removed: 1 });
    expect(stats('a\rb\r', 'a\rb\r')).toEqual({ added: 0, removed: 0 });
    expect(stats('a\r\nb\nc\r', 'a\r\nb\nC\r')).toEqual({ added: 1, removed: 1 });
  });

  it('counts lone CRs made LFs (or CRLFs) only when line endings count', () => {
    expect(stats('a\rb\r', 'a\nb\n')).toEqual({ added: 2, removed: 2 });
    expect(stats('a\rb\r', 'a\r\nb\r\n')).toEqual({ added: 2, removed: 2 });
    expect(stats('a\rb\r', 'a\nb\n', 'ignoreWhitespace')).toEqual({ added: 2, removed: 2 });
    expect(stats('a\rb\r', 'a\nb\n', 'ignoreEol')).toEqual({ added: 0, removed: 0 });
    expect(stats('a\rb\r', 'a\r\nB\r\n', 'ignoreEolAndWhitespace')).toEqual({ added: 1, removed: 1 });
  });

  it('counts only the changes the comparison method recognizes', () => {
    const original = 'a\n  b\nc\n';
    const modified = 'a\r\n\tb\r\nC\r\n';
    expect(stats(original, modified)).toEqual({ added: 3, removed: 3 });
    expect(stats(original, modified, 'ignoreEol')).toEqual({ added: 2, removed: 2 });
    expect(stats(original, modified, 'ignoreWhitespace')).toEqual({ added: 3, removed: 3 });
    expect(stats(original, modified, 'ignoreEolAndWhitespace')).toEqual({ added: 1, removed: 1 });
  });
});

describe('differsUnder', () => {
  it('finds nothing to show for a file not changed yet, empty, or whose only changes the method hides', () => {
    expect(differsUnder('one\ntwo\n', 'one\ntwo\n', 'recognizeAll')).toBe(false);
    expect(differsUnder('one\rtwo\r', 'one\rtwo\r', 'recognizeAll')).toBe(false);
    expect(differsUnder('', '', 'recognizeAll')).toBe(false);
    expect(differsUnder('one\ntwo\n', 'one\r\ntwo\r\n', 'ignoreEol')).toBe(false);
    expect(differsUnder('one\rtwo\r', 'one\ntwo\n', 'ignoreEol')).toBe(false);
    expect(differsUnder('one\n', '  one\n', 'ignoreWhitespace')).toBe(false);
  });

  it('finds lines to show in a changed, added or typed-into file', () => {
    expect(differsUnder('one\ntwo\n', 'one\n2\n', 'recognizeAll')).toBe(true);
    expect(differsUnder('', 'added\n', 'recognizeAll')).toBe(true);
    expect(differsUnder('', 'typed into an empty file', 'ignoreEolAndWhitespace')).toBe(true);
    expect(differsUnder('one\ntwo\n', 'one\r\ntwo\r\n', 'recognizeAll')).toBe(true);
    expect(differsUnder('one\rtwo\r', 'one\rTWO\r', 'recognizeAll')).toBe(true);
    expect(differsUnder('one\rtwo\r', 'one\ntwo\n', 'recognizeAll')).toBe(true);
  });
});
