import { describe, expect, it } from 'vitest';
import { lineChangeStats } from './lineChangeStats';

describe('lineChangeStats', () => {
  it('counts nothing for identical texts', () => {
    expect(lineChangeStats('a\nb\n', 'a\nb\n')).toEqual({ added: 0, removed: 0 });
  });

  it('counts every line of a new file as added', () => {
    expect(lineChangeStats('', 'a\nb\nc\n')).toEqual({ added: 3, removed: 0 });
  });

  it('counts every line of a deleted file as removed', () => {
    expect(lineChangeStats('a\nb\n', '')).toEqual({ added: 0, removed: 2 });
  });

  it('counts a changed line as one removed and one added', () => {
    expect(lineChangeStats('a\nb\nc\n', 'a\nB\nc\n')).toEqual({ added: 1, removed: 1 });
  });

  it('counts insertions and deletions in different places', () => {
    expect(lineChangeStats('a\nb\nc\nd\n', 'x\na\nb\nd\ny\n')).toEqual({ added: 2, removed: 1 });
  });

  it('breaks lines at lone CRs too', () => {
    expect(lineChangeStats('a\rb\rc\r', 'a\rB\rc\r')).toEqual({ added: 1, removed: 1 });
    expect(lineChangeStats('a\rb\r', 'a\rb\r')).toEqual({ added: 0, removed: 0 });
    expect(lineChangeStats('a\r\nb\nc\r', 'a\r\nb\nC\r')).toEqual({ added: 1, removed: 1 });
  });

  it('counts lone CRs made LFs (or CRLFs) only when line endings count', () => {
    expect(lineChangeStats('a\rb\r', 'a\nb\n')).toEqual({ added: 2, removed: 2 });
    expect(lineChangeStats('a\rb\r', 'a\r\nb\r\n')).toEqual({ added: 2, removed: 2 });
    expect(lineChangeStats('a\rb\r', 'a\nb\n', 'ignoreWhitespace')).toEqual({ added: 2, removed: 2 });
    expect(lineChangeStats('a\rb\r', 'a\nb\n', 'ignoreEol')).toEqual({ added: 0, removed: 0 });
    expect(lineChangeStats('a\rb\r', 'a\r\nB\r\n', 'ignoreEolAndWhitespace')).toEqual({ added: 1, removed: 1 });
  });

  it('counts only the changes the comparison method recognizes', () => {
    const original = 'a\n  b\nc\n';
    const modified = 'a\r\n\tb\r\nC\r\n';
    expect(lineChangeStats(original, modified)).toEqual({ added: 3, removed: 3 });
    expect(lineChangeStats(original, modified, 'ignoreEol')).toEqual({ added: 2, removed: 2 });
    expect(lineChangeStats(original, modified, 'ignoreWhitespace')).toEqual({ added: 3, removed: 3 });
    expect(lineChangeStats(original, modified, 'ignoreEolAndWhitespace')).toEqual({ added: 1, removed: 1 });
  });
});
