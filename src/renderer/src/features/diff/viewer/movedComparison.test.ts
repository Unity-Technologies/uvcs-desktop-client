import { describe, expect, it } from 'vitest';
import type { ComparisonMethod } from './comparisonMethod';
import { lineDiff } from './lineDiff';
import { detectMovedBlocks } from './movedBlocks';
import { movedComparison } from './movedComparison';

const text = (lines: string[]): string => lines.map((line) => `${line}\n`).join('');
const filler = (name: string, count: number): string[] => Array.from({ length: count }, (_, index) => `const ${name}${index} = ${index};`);
const FUNCTION = ['function total(items) {', '  let sum = 0;', '  for (const item of items) sum += item.price;', '  return sum;', '}'];
const OTHERS = [...filler('before', 6), ...filler('after', 6)];

/** What "Compare moved code" shows for the one move of a file whose `FUNCTION` moved to its end as `moved`. */
function comparisonOfMove(moved: string[], method: ComparisonMethod = 'recognizeAll') {
  const diff = lineDiff(text([...FUNCTION, ...OTHERS]), text([...OTHERS, ...moved]), method, 'cart.ts').meta;
  const [move] = detectMovedBlocks(diff, method);
  return movedComparison(diff, move!, method, 'cart.ts');
}

describe('movedComparison', () => {
  it('shows code moved as it was, whole, saying nothing changed on the way', () => {
    // The diff of two equal texts has no lines at all: shown as a diff, the dialog was empty.
    expect(comparisonOfMove(FUNCTION)).toEqual({ kind: 'unchanged', code: FUNCTION.join('\n'), note: 'Moved without changes' });
  });

  it('shows code moved with only what the comparison method ignores changed, whole, saying what that is', () => {
    const reindented = FUNCTION.map((line) => `  ${line}`);
    expect(comparisonOfMove(reindented, 'ignoreWhitespace')).toEqual({ kind: 'unchanged', code: reindented.join('\n'), note: 'Only whitespace differs' });
  });

  it('shows code moved and edited as the diff of its two places, with only the edit changed', () => {
    const edited = [...FUNCTION];
    edited[2] = '  for (const item of items) sum += item.cost;';
    const comparison = comparisonOfMove(edited);
    expect(comparison.kind).toBe('diff');
    if (comparison.kind !== 'diff') return;
    expect({ added: comparison.diff.added, removed: comparison.diff.removed }).toEqual({ added: 1, removed: 1 });
    expect(comparison.diff.meta.additionLines.join('')).toBe(text(edited));
  });
});
