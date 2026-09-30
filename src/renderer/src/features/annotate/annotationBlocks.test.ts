import { describe, expect, it } from 'vitest';
import type { Annotation } from '@shared/domain/annotate';
import { adjacentBlock, annotationBlocks, blockAt, blocksInView, distinctAuthors, highlightedChangeset, otherBlocksOfChangeset, walkedBlock } from './annotationBlocks';

const changeset = (changesetId: number, date: string, owner = 'jane@example.com') => ({
  changesetId,
  owner,
  date,
  branch: '/main',
  comment: `Changeset ${changesetId}`,
  isMerge: false,
});

const lines = [1, 1, 7, 4, 4, 4, 1, 7];
const annotation: Annotation = {
  lines: lines.map((changesetId, index) => ({ lineNumber: index + 1, content: String(index), changesetId })),
  changesets: [changeset(1, '2026-01-01T00:00:00Z'), changeset(7, '2026-09-01T00:00:00Z', 'bob@example.com'), changeset(4, '2026-03-01T00:00:00Z')],
};
const blocks = annotationBlocks(annotation);

describe('annotationBlocks', () => {
  it('groups runs of lines from the same changeset', () => {
    expect(blocks.map(({ start, end, changeset }) => [start, end, changeset.changesetId])).toEqual([
      [0, 2, 1],
      [2, 3, 7],
      [3, 6, 4],
      [6, 7, 1],
      [7, 8, 7],
    ]);
  });

  it('shades each block by how recent its changeset is in the file', () => {
    expect(blocks.map((block) => block.age)).toEqual([1, 5, 3, 1, 5]);
  });

  it('has no blocks for an empty file', () => {
    expect(annotationBlocks({ lines: [], changesets: [] })).toEqual([]);
  });
});

describe('blockAt', () => {
  it('finds the block holding a line', () => {
    expect([0, 1, 2, 3, 5, 6, 7].map((line) => blockAt(blocks, line))).toEqual([0, 0, 1, 2, 2, 3, 4]);
  });
});

describe('blocksInView', () => {
  it('takes every block with a line in view', () => {
    expect(blocksInView(blocks, { first: 1, end: 5 })).toEqual({ first: 0, end: 3 });
    expect(blocksInView(blocks, { first: 0, end: 8 })).toEqual({ first: 0, end: 5 });
    expect(blocksInView(blocks, { first: 0, end: 0 })).toEqual({ first: 0, end: 0 });
  });
});

describe('adjacentBlock', () => {
  it('steps to the next and previous block, and stops at the ends', () => {
    expect(adjacentBlock(blocks, 2, 1)).toBe(3);
    expect(adjacentBlock(blocks, 2, -1)).toBe(1);
    expect(adjacentBlock(blocks, 4, 1)).toBeNull();
    expect(adjacentBlock(blocks, 0, -1)).toBeNull();
  });

  it('jumps to the other places the same changeset changed', () => {
    expect(adjacentBlock(blocks, 1, 1, true)).toBe(4);
    expect(adjacentBlock(blocks, 4, -1, true)).toBe(1);
    expect(adjacentBlock(blocks, 2, 1, true)).toBeNull();
  });
});

describe('walkedBlock', () => {
  it('walks from the picked block', () => {
    expect(walkedBlock(blocks, 2, 1, false, 0)).toBe(3);
    expect(walkedBlock(blocks, 1, 1, true, 0)).toBe(4);
    expect(walkedBlock(blocks, 0, -1, false, 5)).toBeNull();
  });

  it('picks the block at the top of the view first, whichever the key', () => {
    expect(walkedBlock(blocks, -1, 1, false, 5)).toBe(2);
    expect(walkedBlock(blocks, -1, -1, true, 6)).toBe(3);
  });

  it('has nowhere to go in an empty file', () => {
    expect(walkedBlock([], -1, 1, false, 0)).toBeNull();
  });
});

describe('otherBlocksOfChangeset', () => {
  it("counts the other places the block's changeset changed", () => {
    expect([0, 1, 2, 3, 4].map((index) => otherBlocksOfChangeset(blocks, index))).toEqual([1, 1, 0, 1, 1]);
  });

  it('has none without a block', () => {
    expect(otherBlocksOfChangeset(blocks, -1)).toBe(0);
  });
});

describe('highlightedChangeset', () => {
  it("lights up the picked block's changeset when it changed other blocks too", () => {
    expect(highlightedChangeset(blocks, 1)).toBe(7);
  });

  it('lights up nothing for a changeset of one block, or with nothing picked', () => {
    expect(highlightedChangeset(blocks, 2)).toBeNull();
    expect(highlightedChangeset(blocks, -1)).toBeNull();
  });
});

describe('distinctAuthors', () => {
  it('counts each author once', () => {
    expect(distinctAuthors(annotation)).toBe(2);
  });
});
