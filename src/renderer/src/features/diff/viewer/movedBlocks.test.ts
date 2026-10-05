import { describe, expect, it } from 'vitest';
import { countCalls } from '@shared/testing/countCalls';
import type { ComparisonMethod } from './comparisonMethod';
import { lineDiff } from './lineDiff';
import { detectMovedBlocks, MAX_BLOCKS, MAX_CHANGED_LINES, MAX_COMPARISONS, moveContaining, MoveSearch, type MovedBlock } from './movedBlocks';

const text = (lines: string[], lineBreak = '\n'): string => lines.map((line) => `${line}${lineBreak}`).join('');
const movesIn = (original: string[], modified: string[], method: ComparisonMethod = 'recognizeAll') =>
  detectMovedBlocks(lineDiff(text(original), text(modified), method).meta, method);

const FUNCTION = ['function total(items) {', '  let sum = 0;', '  for (const item of items) sum += item.price;', '  return sum;', '}'];
const filler = (name: string, count: number): string[] => Array.from({ length: count }, (_, index) => `const ${name}${index} = ${index};`);
const BEFORE = filler('before', 6);
const AFTER = filler('after', 6);

describe('detectMovedBlocks', () => {
  it('finds a block moved as it was, with no line changed', () => {
    expect(movesIn([...FUNCTION, ...BEFORE, ...AFTER], [...BEFORE, ...AFTER, ...FUNCTION])).toEqual([
      { deletions: { start: 1, count: 5 }, additions: { start: 13, count: 5 }, changed: [], replaced: [] },
    ]);
  });

  it('finds a block moved and edited a little, and tells which of its lines changed', () => {
    const edited = [...FUNCTION];
    edited[2] = '  for (const item of items) sum += item.cost;';
    expect(movesIn([...FUNCTION, ...BEFORE, ...AFTER], [...BEFORE, ...AFTER, ...edited])).toEqual([
      {
        deletions: { start: 1, count: 5 },
        additions: { start: 13, count: 5 },
        changed: [
          { side: 'deletions', lineNumber: 3 },
          { side: 'additions', lineNumber: 15 },
        ],
        replaced: [{ deletion: 3, addition: 15 }],
      },
    ]);
  });

  it('pairs each line it replaces with the added line most like it, never with a line only added on the way', () => {
    const edited = [...FUNCTION.slice(0, 2), '  // add every price', '  for (const item of items) sum += item.cost;', ...FUNCTION.slice(3)];
    const [move] = movesIn([...FUNCTION, ...BEFORE, ...AFTER], [...BEFORE, ...AFTER, ...edited]);
    expect(move?.changed).toEqual([
      { side: 'deletions', lineNumber: 3 },
      { side: 'additions', lineNumber: 15 },
      { side: 'additions', lineNumber: 16 },
    ]);
    expect(move?.replaced).toEqual([{ deletion: 3, addition: 16 }]);
  });

  it('takes a block changed by more than a fifth of its words as removed and added, not moved', () => {
    const rewritten = ['function total(rows) {', '  return rows.reduce((sum, row) => sum + row.price, 0);', '}', '// totals', '// end'];
    expect(movesIn([...FUNCTION, ...BEFORE, ...AFTER], [...BEFORE, ...AFTER, ...rewritten])).toEqual([]);
  });

  it('ignores a single line moved, too common to be a move', () => {
    expect(movesIn(['import { a } from "a";', ...BEFORE, ...AFTER], [...BEFORE, ...AFTER, 'import { a } from "a";'])).toEqual([]);
  });

  it('ignores lines of braces and blanks, alike everywhere', () => {
    expect(movesIn(['}', '', '}', ...BEFORE, ...AFTER], [...BEFORE, ...AFTER, '}', '', '}'])).toEqual([]);
  });

  it('takes a block edited where it is as an edit, not a move', () => {
    const edited = [...FUNCTION];
    edited[3] = '  return sum + 1;';
    expect(movesIn([...BEFORE, ...FUNCTION, ...AFTER], [...BEFORE, ...edited, ...AFTER])).toEqual([]);
  });

  it('finds a block moved into new code, as the lines of it that match', () => {
    const modified = [...BEFORE, ...AFTER, 'const extra = 1;', ...FUNCTION, 'export default total;'];
    expect(movesIn([...FUNCTION, ...BEFORE, ...AFTER], modified)).toEqual([{ deletions: { start: 1, count: 5 }, additions: { start: 14, count: 5 }, changed: [], replaced: [] }]);
  });

  it('pairs each place once, however many blocks moved', () => {
    const other = ['class Cart {', '  items = [];', '  add(item) { this.items.push(item); }', '}'];
    const moves = movesIn([...FUNCTION, ...BEFORE, ...other, ...AFTER], [...BEFORE, ...AFTER, ...other, ...FUNCTION]);
    expect(moves.map(({ deletions, additions }) => ({ deletions, additions }))).toEqual([
      { deletions: { start: 1, count: 5 }, additions: { start: 17, count: 5 } },
      { deletions: { start: 12, count: 4 }, additions: { start: 13, count: 4 } },
    ]);
  });

  it('follows the comparison method: a block moved and re-indented differs in every line only while whitespace counts', () => {
    const indented = FUNCTION.map((line) => `    ${line}`);
    const original = [...FUNCTION, ...BEFORE, ...AFTER];
    const modified = [...BEFORE, ...AFTER, 'class Totals {', ...indented, '}'];
    const everyLine = [1, 2, 3, 4, 5].map((lineNumber) => ({ side: 'deletions', lineNumber })).concat([14, 15, 16, 17, 18].map((lineNumber) => ({ side: 'additions', lineNumber })));
    const everyPair = [1, 2, 3, 4, 5].map((line) => ({ deletion: line, addition: line + 13 }));
    expect(movesIn(original, modified, 'recognizeAll')).toEqual([{ deletions: { start: 1, count: 5 }, additions: { start: 14, count: 5 }, changed: everyLine, replaced: everyPair }]);
    expect(movesIn(original, modified, 'ignoreWhitespace')).toEqual([{ deletions: { start: 1, count: 5 }, additions: { start: 14, count: 5 }, changed: [], replaced: [] }]);
  });

  it('reads files with CRLF line breaks', () => {
    const original = text([...FUNCTION, ...BEFORE, ...AFTER], '\r\n');
    const modified = text([...BEFORE, ...AFTER, ...FUNCTION], '\r\n');
    expect(detectMovedBlocks(lineDiff(original, modified, 'recognizeAll').meta, 'recognizeAll')).toEqual([
      { deletions: { start: 1, count: 5 }, additions: { start: 13, count: 5 }, changed: [], replaced: [] },
    ]);
  });

  it('counts the words of any script, so one word changed in Unicode text is a small edit', () => {
    const greeting = ['const saludo = "¡Hola, señor García!";', 'const despedida = "Adiós, señora Muñoz";', 'const 名前 = "東京タワー";'];
    const edited = [...greeting];
    edited[1] = 'const despedida = "Adiós, señora Núñez";';
    expect(movesIn([...greeting, ...BEFORE, ...AFTER], [...BEFORE, ...AFTER, ...edited])).toEqual([
      {
        deletions: { start: 1, count: 3 },
        additions: { start: 13, count: 3 },
        changed: [
          { side: 'deletions', lineNumber: 2 },
          { side: 'additions', lineNumber: 14 },
        ],
        replaced: [{ deletion: 2, addition: 14 }],
      },
    ]);
  });

  it(`looks for no moves in a diff of more than ${MAX_BLOCKS} changes`, () => {
    const lines = filler('line', 3 * MAX_BLOCKS);
    const everyThirdChanged = lines.map((line, index) => (index % 3 === 0 ? `${line} // changed` : line));
    expect(movesIn([...FUNCTION, ...lines], [...everyThirdChanged, ...FUNCTION])).toEqual([]);
    expect(movesIn([...FUNCTION, ...lines], [...lines, ...FUNCTION])).toHaveLength(1);
  });

  it(`looks for no moves in a diff of more than ${MAX_CHANGED_LINES} changed lines`, () => {
    const original = [...FUNCTION, ...BEFORE, ...AFTER];
    expect(movesIn([...original, ...filler('old', MAX_CHANGED_LINES / 2)], [...BEFORE, ...AFTER, ...FUNCTION, ...filler('new', MAX_CHANGED_LINES / 2)])).toEqual([]);
    expect(movesIn(original, [...BEFORE, ...AFTER, ...FUNCTION])).toHaveLength(1);
  });

  it('spends a bounded number of comparisons on a file whose many look-alike blocks were all reordered', () => {
    const blocks = Array.from({ length: 24 }, (_, index) => [`function add${index}(a, b) {`, `  return a + b + ${index};`, '}', ...filler(`use${index}_`, 6)]);
    const original = blocks.flatMap((block, index) => [...block, `// section ${index}`]);
    const modified = [...blocks].reverse().flatMap((block, index) => [`// section ${index}`, ...block]);
    const meta = lineDiff(text(original), text(modified), 'recognizeAll').meta;
    const { result, calls } = countCalls(MoveSearch.prototype, 'compare', () => detectMovedBlocks(meta, 'recognizeAll'));
    expect(result.length).toBeGreaterThan(20);
    expect(calls).toBeLessThanOrEqual(MAX_COMPARISONS);
  });
});

describe('moveContaining', () => {
  const move: MovedBlock = { deletions: { start: 3, count: 2 }, additions: { start: 20, count: 2 }, changed: [], replaced: [] };

  it('finds the move a line is in, in either of its places', () => {
    expect(moveContaining([move], { side: 'deletions', lineNumber: 4 })).toBe(move);
    expect(moveContaining([move], { side: 'additions', lineNumber: 20 })).toBe(move);
  });

  it("finds none for a line outside its places, or with the other side's number", () => {
    expect(moveContaining([move], { side: 'deletions', lineNumber: 5 })).toBeUndefined();
    expect(moveContaining([move], { side: 'deletions', lineNumber: 20 })).toBeUndefined();
  });
});
