import { describe, expect, it } from 'vitest';
import { suggestionComparison, suggestionComparisonTitle } from './suggestionComparison';

describe('suggestionComparison', () => {
  it("is the box's diff, numbered as the file's lines, with what it adds and removes", () => {
    const comparison = suggestionComparison('src/Switch.cs', { kind: 'diff', replacedText: '{\n    var s = A();\n}\n', suggestedText: '{\n    Shelve s = A();\n    Log();\n}\n', firstLine: 9, rowCount: 7 });
    expect(comparison.kind).toBe('diff');
    if (comparison.kind !== 'diff') return;
    expect(comparison.diff.meta.hunks[0]).toMatchObject({ deletionStart: 9, additionStart: 9 });
    expect([comparison.diff.added, comparison.diff.removed]).toEqual([2, 1]);
  });
});

describe('suggestionComparisonTitle', () => {
  it('names the lines the suggestion replaces', () => {
    expect(suggestionComparisonTitle({ firstLine: 9, lastLine: 16 })).toBe('Suggested change on lines 9–16');
    expect(suggestionComparisonTitle({ firstLine: 9, lastLine: 9 })).toBe('Suggested change on line 9');
  });
});
