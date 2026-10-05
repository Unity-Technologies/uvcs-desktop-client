import { describe, expect, it } from 'vitest';
import type { DisplayMeta } from './changeBlocks';
import type { MovedBlock } from './movedBlocks';
import { movedWordMarks } from './movedWordMarks';

/** A diff's two files as lines, numbered from 1; its hunks don't matter here. */
const meta = (deletionLines: string[], additionLines: string[]): DisplayMeta => ({ deletionLines, additionLines, hunks: [] });

const move = (replaced: MovedBlock['replaced']): MovedBlock => ({ deletions: { start: 1, count: 2 }, additions: { start: 3, count: 2 }, changed: [], replaced });

describe('movedWordMarks', () => {
  it('marks the words each line edited inside moved code changed, against what it became', () => {
    const diff = meta(['import type { ComparisonMethod } from "./comparisonMethod";\n', 'keep();\n'], ['a();\n', 'b();\n', 'import type { ComparisonMethod2 } from "./comparisonMethod";\n', 'keep();\n']);
    const marks = movedWordMarks(diff, [move([{ deletion: 1, addition: 3 }])]);
    const removed = diff.deletionLines[0]!;
    const added = diff.additionLines[2]!;
    expect(marks.deletions.get(1)?.map(({ start, end }) => removed.slice(start, end))).toEqual(['ComparisonMethod']);
    expect(marks.additions.get(3)?.map(({ start, end }) => added.slice(start, end))).toEqual(['ComparisonMethod2']);
  });

  it('marks nothing on lines that moved as they were, or were only added or removed on the way', () => {
    const marks = movedWordMarks(meta(['x\n', 'y\n'], ['a\n', 'b\n', 'x\n', 'y\n']), [move([])]);
    expect([...marks.deletions.keys(), ...marks.additions.keys()]).toEqual([]);
  });

  it('marks nothing on lines too long to diff word by word, as Pierre', () => {
    const long = 'x'.repeat(1_001);
    const marks = movedWordMarks(meta([`${long}\n`, 'y\n'], ['a\n', 'b\n', `${long}z\n`, 'y\n']), [move([{ deletion: 1, addition: 3 }])]);
    expect(marks.deletions.get(1)).toEqual([]);
    expect(marks.additions.get(3)).toEqual([]);
  });
});
