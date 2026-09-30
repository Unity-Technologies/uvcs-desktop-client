import { describe, expect, it } from 'vitest';
import type { AnnotationBlock } from './annotationBlocks';
import { ANNOTATION_LINE_HEIGHT, CODE_PADDING_TOP, lineAtTop, roomAroundShown, scrollTopRevealing } from './annotationLayout';

const changeset = { changesetId: 1, owner: 'ana', date: '2026-01-01T00:00:00Z', branch: '/main', comment: '', isMerge: false };
const block = (start: number, end: number): AnnotationBlock => ({ start, end, changeset, age: 1 });
const lineTop = (line: number): number => CODE_PADDING_TOP + line * ANNOTATION_LINE_HEIGHT;

describe('lineAtTop', () => {
  it('is the line under the top edge, past the padding', () => {
    expect(lineAtTop(0)).toBe(0);
    expect(lineAtTop(lineTop(12))).toBe(12);
    expect(lineAtTop(lineTop(12) + ANNOTATION_LINE_HEIGHT - 1)).toBe(12);
  });
});

describe('scrollTopRevealing', () => {
  const view = { scrollTop: lineTop(10), height: 10 * ANNOTATION_LINE_HEIGHT };

  it('leaves a block whose first line is in view where it is', () => {
    expect(scrollTopRevealing(block(10, 30), view)).toBeNull();
    expect(scrollTopRevealing(block(19, 20), view)).toBeNull();
  });

  it('brings a block out of view a few lines from the top', () => {
    expect(scrollTopRevealing(block(40, 41), view)).toBe(lineTop(37));
    expect(scrollTopRevealing(block(2, 12), view)).toBe(lineTop(-1));
  });
});

describe('roomAroundShown', () => {
  const blocks = [block(0, 5), block(5, 6), block(6, 20), block(20, 21)];

  it('keeps the lines of the blocks not rendered as room above and below', () => {
    expect(roomAroundShown(blocks, { first: 1, end: 3 })).toEqual({ above: 5, below: 1 });
    expect(roomAroundShown(blocks, { first: 0, end: 4 })).toEqual({ above: 0, below: 0 });
  });

  it('keeps the whole file as room when no block is rendered', () => {
    expect(roomAroundShown(blocks, { first: 0, end: 0 })).toEqual({ above: 0, below: 21 });
    expect(roomAroundShown([], { first: 0, end: 0 })).toEqual({ above: 0, below: 0 });
  });
});
