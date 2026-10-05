import { describe, expect, it } from 'vitest';
import type { DisplayMeta } from './changeBlocks';
import type { MovedBlock } from './movedBlocks';
import { movedCopies } from './movedCopies';

const meta: DisplayMeta = {
  deletionLines: ['a\n', 'moved one\n', 'moved two\n', 'b\n'],
  additionLines: ['a\n', 'b\n', 'moved one\n', 'moved 2\r\n', 'c'],
  hunks: [],
};
const move: MovedBlock = { deletions: { start: 2, count: 2 }, additions: { start: 3, count: 2 }, changed: [], replaced: [] };

describe('movedCopies', () => {
  it("is the text of a move's two places, line breaks and all, to compare them", () => {
    expect(movedCopies(meta, move)).toEqual({ original: 'moved one\nmoved two\n', modified: 'moved one\nmoved 2\r\n' });
  });
});
