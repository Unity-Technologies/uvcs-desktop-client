import { describe, expect, it } from 'vitest';
import { rangeWords, rangeWordsInline } from './rangeWords';

describe('rangeWords', () => {
  it('names one line or a range', () => {
    expect(rangeWords({ firstLine: 7, lastLine: 7 })).toBe('Line 7');
    expect(rangeWords({ firstLine: 7, lastLine: 9 })).toBe('Lines 7–9');
  });

  it('reads inside a sentence', () => {
    expect(rangeWordsInline({ firstLine: 7, lastLine: 9 })).toBe('lines 7–9');
  });
});
