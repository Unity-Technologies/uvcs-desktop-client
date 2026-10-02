import { describe, expect, it } from 'vitest';
import { changedLinePairs, wordDiffedLinePairs } from './changedLinePairs';
import { lineDiff } from './lineDiff';

describe('wordDiffedLinePairs', () => {
  it('counts the lines a change replaces, not the lines it only adds or removes', () => {
    const original = 'a\nb\nc\nd\ne\nf\n';
    const changed = 'a\nB\nC\nd\nx\ny\nz\ne\n';
    expect(wordDiffedLinePairs(lineDiff(original, changed, 'recognizeAll').meta)).toBe(2);
  });

  it('counts nothing for a diff that only adds lines', () => {
    expect(wordDiffedLinePairs(lineDiff('a\n', 'a\nb\nc\n', 'recognizeAll').meta)).toBe(0);
  });
});

describe('changedLinePairs', () => {
  it("pairs each change's removed lines with its added lines, in order", () => {
    const diff = lineDiff('a\nb\nc\nd\ne\nf\n', 'a\nB\nC\nd\nx\ny\nz\ne\n', 'recognizeAll').meta;
    expect(changedLinePairs(diff)).toEqual([
      { deletion: 1, addition: 1 },
      { deletion: 2, addition: 2 },
    ]);
  });
});
