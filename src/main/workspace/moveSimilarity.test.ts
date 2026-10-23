import { describe, expect, it } from 'vitest';
import { comparedLines, sizeSimilarity, textSimilarity } from './moveSimilarity';

const lines = (...texts: string[]) => texts;
const numbered = (count: number, prefix = 'line') => Array.from({ length: count }, (_, index) => `${prefix}${index}`);

describe('text similarity', () => {
  it('is 1 for the same lines, whitespace and line ends aside', () => {
    expect(textSimilarity(comparedLines('class A {\n  int x;\n}\n'), comparedLines('class A {\r\n\tint  x;\r\n}'))).toBe(1);
  });

  it("counts the lines added and removed per line of the deleted file, as cm's move detection does", () => {
    const deleted = numbered(10);
    // One line changed: one removed and one added, 2 changes in 10 lines.
    expect(textSimilarity(deleted, [...deleted.slice(0, 9), 'other'])).toBeCloseTo(0.8);
    // Five lines added at the end: 5 changes in 10.
    expect(textSimilarity(deleted, [...deleted, ...numbered(5, 'new')])).toBeCloseTo(0.5);
    // Half the lines removed: 5 changes in 10.
    expect(textSimilarity(deleted, deleted.slice(5))).toBeCloseTo(0.5);
  });

  it('is 0 for files with no line in common, and never below it', () => {
    expect(textSimilarity(numbered(10), numbered(30, 'other'))).toBe(0);
    expect(textSimilarity(numbered(3), [...numbered(3), ...numbered(20, 'more')])).toBe(0);
  });

  it('takes line order into account: the same lines reordered are changes', () => {
    expect(textSimilarity(lines('a', 'b', 'c', 'd'), lines('d', 'c', 'b', 'a'))).toBeLessThan(0.5);
  });

  it('matches an empty deleted file only with an empty one', () => {
    expect(textSimilarity(comparedLines(''), comparedLines(''))).toBe(1);
    expect(textSimilarity([], ['a'])).toBe(0);
  });

  it("doesn't tell what would take more work than allowed: the same lines reordered, in large files", () => {
    const deleted = numbered(2_000);
    const reordered = [...deleted.slice(1_000), ...deleted.slice(0, 1_000)];
    const work = 4_000 * 100;

    // The same lines in another order pass the multiset bound and need a long diff.
    expect(textSimilarity(deleted, reordered, work)).toBeNull();
    // Alike files need a short one, within the same work.
    expect(textSimilarity(deleted, [...deleted.slice(0, 1_990), ...numbered(10, 'new')], work)).toBeCloseTo(0.99);
    // Unlike ones need none.
    expect(textSimilarity(deleted, numbered(2_000, 'other'), work)).toBe(0);
  });

  // A dissimilar pair is told without a diff; a similar one runs a diff bounded by the deleted file's lines.
  it('scores large files', () => {
    const deleted = numbered(5_000);
    const edited = deleted.map((line, index) => (index % 10 === 0 ? `${line} edited` : line));
    expect(textSimilarity(deleted, edited)).toBeCloseTo(0.8);
    expect(textSimilarity(deleted, numbered(5_000, 'other'))).toBe(0);
  });
});

describe('compared lines', () => {
  it('splits on any line end and drops whitespace, a last line break opening no line', () => {
    expect(comparedLines('a b\r\nc\rd\n')).toEqual(['ab', 'c', 'd']);
    expect(comparedLines('\n\n')).toEqual(['', '']);
    expect(comparedLines('')).toEqual(['']);
  });
});

describe('size similarity', () => {
  it('is how far the sizes are apart per byte of the deleted file', () => {
    expect(sizeSimilarity(1000, 1000)).toBe(1);
    expect(sizeSimilarity(1000, 750)).toBeCloseTo(0.75);
    expect(sizeSimilarity(1000, 1300)).toBeCloseTo(0.7);
    expect(sizeSimilarity(1000, 5000)).toBe(0);
  });

  it('matches an empty deleted file only with an empty one', () => {
    expect(sizeSimilarity(0, 0)).toBe(1);
    expect(sizeSimilarity(0, 10)).toBe(0);
  });
});
