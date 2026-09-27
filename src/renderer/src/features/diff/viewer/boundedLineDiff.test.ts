import { diffArrays, diffLines } from 'diff';
import { describe, expect, it } from 'vitest';
import { COMPARISON_METHODS } from './comparisonMethod';
import { lineDiff, lineDiffOptions } from './lineDiff';

const code = (lines: number, changed: (index: number) => boolean, seed = 0): string =>
  Array.from({ length: lines }, (_, index) => (changed(index) ? `  let changed${index} = other(${seed});\n` : `  const value${index} = compute(${index % 97}, options.flag${index % 13});\n`)).join('');

const timed = <T>(run: () => T): { result: T; ms: number } => {
  const started = performance.now();
  const result = run();
  return { result, ms: performance.now() - started };
};

describe('installBoundedLineDiff', () => {
  it("leaves diff's line diff as it was for texts Myers diffs cheaply", () => {
    const original = code(300, () => false);
    const modified = code(300, (index) => index % 40 === 5);
    const lines = (text: string) => text.match(/[^\n]*\n|[^\n]+$/g) ?? [];
    const expected = diffArrays(lines(original), lines(modified)).map(({ count, added, removed, value }) => ({ count, added, removed, value: value.join('') }));
    expect(diffLines(original, modified)).toEqual(expected);
  });

  it('diffs a rewritten 20,000-line file at once, under every comparison method', () => {
    const original = code(20_000, () => false);
    const modified = code(20_000, () => true, 1);
    for (const { value: method } of COMPARISON_METHODS) {
      const { result, ms } = timed(() => lineDiff(original, modified, method));
      expect(ms).toBeLessThan(2_000);
      expect(result).toMatchObject({ added: 20_000, removed: 20_000 });
    }
  });

  it('diffs 100,000 lines with every seventh one changed as that many changes', () => {
    const original = code(100_000, () => false);
    const modified = code(100_000, (index) => index % 7 === 3);
    const { result, ms } = timed(() => lineDiff(original, modified, 'ignoreWhitespace'));
    expect(ms).toBeLessThan(3_000);
    expect(result).toMatchObject({ added: 14_286, removed: 14_286 });
  });

  it('compares lines by the comparison method, as a comparator would', () => {
    expect(lineDiff('a\n  b\nc\n', 'a\nb  \nc\n', 'ignoreWhitespace')).toMatchObject({ added: 0, removed: 0 });
    expect(lineDiff('a\rb\r', 'a\nb\n', 'recognizeAll')).toMatchObject({ added: 2, removed: 2 });
    // The options' comparator is what diffLines is given: its key is found for it.
    expect(diffLines('a\n  b\n', 'a\nb\n', lineDiffOptions('a\n  b\n', 'a\nb\n', 'ignoreWhitespace'))).toHaveLength(1);
  });
});
