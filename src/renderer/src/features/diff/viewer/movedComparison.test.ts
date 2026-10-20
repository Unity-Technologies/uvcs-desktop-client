import { describe, expect, it } from 'vitest';
import type { ComparisonMethod } from './comparisonMethod';
import { lineDiff } from './lineDiff';
import { detectMovedBlocks } from './movedBlocks';
import { movedComparison } from './movedComparison';

const text = (lines: string[], lineBreak = '\n'): string => lines.map((line) => `${line}${lineBreak}`).join('');
const filler = (name: string, count: number): string[] => Array.from({ length: count }, (_, index) => `const ${name}${index} = ${index};`);
const FUNCTION = ['function total(items) {', '  let sum = 0;', '  for (const item of items) sum += item.price;', '  return sum;', '}'];
const OTHERS = [...filler('before', 6), ...filler('after', 6)];

/**
 * What "Compare moved code" shows for the one move of a file whose `FUNCTION` moved to its end as `moved`, its lines
 * ending as `lineBreaks` says (the original's, then the modified's).
 */
function comparisonOfMove(moved: string[], method: ComparisonMethod = 'recognizeAll', lineBreaks: [string, string] = ['\n', '\n']) {
  const [originalBreak, modifiedBreak] = lineBreaks;
  const diff = lineDiff(text([...FUNCTION, ...OTHERS], originalBreak), text([...OTHERS, ...moved], modifiedBreak), method, 'cart.ts').meta;
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

  it('shows code of a CRLF file moved as it was without its last line break, whatever the break', () => {
    expect(comparisonOfMove(FUNCTION, 'recognizeAll', ['\r\n', '\r\n'])).toEqual({ kind: 'unchanged', code: FUNCTION.join('\r\n'), note: 'Moved without changes' });
  });

  it('says when only line endings changed on the way, and when line endings and whitespace did', () => {
    expect(comparisonOfMove(FUNCTION, 'ignoreEol', ['\r\n', '\n'])).toMatchObject({ kind: 'unchanged', note: 'Only line endings differ' });
    const reindented = FUNCTION.map((line) => `  ${line}`);
    expect(comparisonOfMove(reindented, 'ignoreEolAndWhitespace', ['\r\n', '\n'])).toMatchObject({ kind: 'unchanged', note: 'Only line endings and whitespace differ' });
  });

  it('shows code moved and edited as the diff of its two places, with only the edit changed', () => {
    const edited = [...FUNCTION];
    edited[2] = '  for (const item of items) sum += item.cost;';
    const comparison = comparisonOfMove(edited);
    expect(comparison).toMatchObject({ kind: 'diff', diff: { added: 1, removed: 1, meta: { additionLines: expect.arrayContaining(edited.map((line) => `${line}\n`)) } } });
  });
});
