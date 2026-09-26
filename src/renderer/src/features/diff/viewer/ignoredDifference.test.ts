import { describe, expect, it } from 'vitest';
import { ignoredDifference } from './ignoredDifference';

describe('ignoredDifference', () => {
  it('names a change of line endings, a missing final one included', () => {
    expect(ignoredDifference('a\nb\n', 'a\r\nb\r\n')).toBe('lineEndings');
    expect(ignoredDifference('a\nb\n', 'a\nb')).toBe('lineEndings');
    expect(ignoredDifference('a\rb\r', 'a\nb\n')).toBe('lineEndings');
    expect(ignoredDifference('a\rb\r', 'a\r\nb\r\n')).toBe('lineEndings');
  });

  it('names a change of spaces and tabs at the ends of lines', () => {
    expect(ignoredDifference('  a\nb\n', '\ta\nb  \n')).toBe('whitespace');
  });

  it('names both when both changed', () => {
    expect(ignoredDifference('  a\nb\n', '\ta\r\nb\r\n')).toBe('lineEndingsAndWhitespace');
  });
});
