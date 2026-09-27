import { describe, expect, it } from 'vitest';
import { ignoredDifference, methodHidingEveryChange } from './ignoredDifference';

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

describe('methodHidingEveryChange', () => {
  it('offers the method ignoring least that hides every change', () => {
    expect(methodHidingEveryChange('a\r\nb\r\n', 'a\nb\n', 'recognizeAll')).toBe('ignoreEol');
    expect(methodHidingEveryChange('a\rb\r', 'a\nb\n', 'recognizeAll')).toBe('ignoreEol');
    expect(methodHidingEveryChange('  a\nb\n', '\ta\nb  \n', 'recognizeAll')).toBe('ignoreWhitespace');
    expect(methodHidingEveryChange('  a\nb\n', '\ta\r\nb\r\n', 'recognizeAll')).toBe('ignoreEolAndWhitespace');
  });

  it('offers only a method that ignores more than the one in use', () => {
    expect(methodHidingEveryChange('  a\nb\n', '\ta\r\nb\r\n', 'ignoreEol')).toBe('ignoreEolAndWhitespace');
    expect(methodHidingEveryChange('  a\nb\n', '\ta\r\nb\r\n', 'ignoreWhitespace')).toBe('ignoreEolAndWhitespace');
    expect(methodHidingEveryChange('  a\nb\n', '\ta\r\nB\r\n', 'ignoreEolAndWhitespace')).toBeNull();
  });

  it('offers nothing when the texts differ in more than any method ignores', () => {
    expect(methodHidingEveryChange('a\r\nb\r\n', 'a\nB\n', 'recognizeAll')).toBeNull();
    expect(methodHidingEveryChange('a\nb\n', 'a\nb\nc\n', 'recognizeAll')).toBeNull();
    expect(methodHidingEveryChange('', 'a\n', 'recognizeAll')).toBeNull();
  });
});
