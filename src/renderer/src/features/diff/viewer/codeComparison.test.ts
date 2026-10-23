import { describe, expect, it } from 'vitest';
import { codeComparison, comparisonSubtitle } from './codeComparison';

describe('codeComparison', () => {
  it('diffs two pieces that differ', () => {
    expect(codeComparison('a\nb\n', 'a\nc\n', 'recognizeAll', 'x.ts', 'Same').kind).toBe('diff');
  });

  it('shows two equal pieces as one, with the note saying they are the same', () => {
    expect(codeComparison('a\nb\n', 'a\nb\n', 'recognizeAll', 'x.ts', 'Same text')).toEqual({ kind: 'unchanged', code: 'a\nb', note: 'Same text' });
  });

  it('says what the method ignores when that is all that differs', () => {
    expect(codeComparison('a\n  b', 'a\nb', 'ignoreWhitespace', 'x.ts', 'Same')).toEqual({ kind: 'unchanged', code: 'a\nb', note: 'Only whitespace differs' });
  });
});

describe('comparisonSubtitle', () => {
  it('adds the note of pieces shown as one after what they are', () => {
    expect(comparisonSubtitle('cart.ts', { kind: 'unchanged', code: 'a', note: 'Moved without changes' })).toBe('cart.ts · Moved without changes');
    expect(comparisonSubtitle('cart.ts', codeComparison('a', 'b', 'recognizeAll', 'cart.ts', 'Same'))).toBe('cart.ts');
  });
});
