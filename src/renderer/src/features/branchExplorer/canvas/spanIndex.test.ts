import { describe, expect, it } from 'vitest';
import { SpanIndex } from './spanIndex';

/** Spans over `width`, like lanes over columns: mostly short, a few reaching across much of it. */
function randomSpans(count: number, width: number, seed = 3): { lefts: number[]; rights: number[] } {
  let state = seed;
  const random = (): number => (state = (state * 16807) % 2147483647) / 2147483647;
  const lefts: number[] = [];
  const rights: number[] = [];
  for (let index = 0; index < count; index++) {
    const left = random() * width;
    lefts.push(left);
    rights.push(left + (random() < 0.0005 ? random() * width : random() * 100));
  }
  return { lefts, rights };
}

describe('SpanIndex', () => {
  it('finds exactly the spans reaching into a range, in index order', () => {
    const { lefts, rights } = randomSpans(2_000, 10_000);
    const index = new SpanIndex(lefts, rights);
    for (const [left, right] of [[0, 50], [4_000, 4_200], [9_990, 20_000], [-100, -1], [5_000, 5_000], [-1, 100_000]] as const) {
      const expected = lefts.flatMap((start, item) => (start <= right && rights[item]! >= left ? [item] : []));
      expect(index.overlapping(left, right, [])).toEqual(expected);
    }
  });

  it('counts spans that only touch the range', () => {
    const index = new SpanIndex([0, 20], [10, 30]);
    expect(index.overlapping(10, 20, [])).toEqual([0, 1]);
    expect(index.overlapping(11, 19, [])).toEqual([]);
  });

  it('works without spans', () => {
    expect(new SpanIndex([], []).overlapping(0, 100, [])).toEqual([]);
  });

  it('answers 20,000 screens over 100,000 spans well within a second', () => {
    const { lefts, rights } = randomSpans(100_000, 1_000_000);
    const index = new SpanIndex(lefts, rights);
    const found: number[] = [];
    const started = performance.now();
    for (let screen = 0; screen < 20_000; screen++) index.overlapping(screen * 50, screen * 50 + 300, found);
    expect(performance.now() - started).toBeLessThan(1000);
  });
});
