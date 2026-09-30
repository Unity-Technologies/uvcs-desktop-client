import { describe, expect, it } from 'vitest';
import type { KeyboardEvent } from 'react';
import { isReviewKey, toggleReviewedFromKey } from './reviewKey';
import type { ReviewStatus } from './reviewStatus';
import type { ListReview } from './useReviewMode';

/** A list of files with their marks; folders (null) have nothing to review. R toggles like the list does. */
function reviewList(marks: Record<string, ReviewStatus | null>) {
  const toggled: string[][] = [];
  let moves = 0;
  const review: ListReview<string> = {
    on: true,
    statusOf: (path) => marks[path] ?? null,
    toggle: (paths) => void toggled.push(paths),
  };
  const pressR = (selected: string[]) => toggleReviewedFromKey(review, selected, () => moves++);
  return { pressR, toggled, moves: () => moves };
}

const key = (key: string, modifiers: Partial<Record<'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey', boolean>> = {}) =>
  ({ key, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...modifiers }) as KeyboardEvent;

describe('R on a list of files', () => {
  it('is R alone, not a shortcut holding it', () => {
    expect(isReviewKey(key('r'))).toBe(true);
    expect(isReviewKey(key('r', { metaKey: true }))).toBe(false);
    expect(isReviewKey(key('R', { shiftKey: true }))).toBe(false);
  });

  it('marks the file and moves on to the next, so a review goes R, R, R down the list', () => {
    const list = reviewList({ 'a.ts': 'unreviewed', 'b.ts': 'changedSinceReview' });
    list.pressR(['a.ts']);
    list.pressR(['b.ts']);
    expect(list.toggled).toEqual([['a.ts'], ['b.ts']]);
    expect(list.moves()).toBe(2);
  });

  it('clears the mark of a reviewed file, staying on it', () => {
    const list = reviewList({ 'a.ts': 'reviewed' });
    list.pressR(['a.ts']);
    expect(list.toggled).toEqual([['a.ts']]);
    expect(list.moves()).toBe(0);
  });

  it('toggles a selection of several files without moving, leaving folders out', () => {
    const list = reviewList({ 'a.ts': 'unreviewed', 'b.ts': 'reviewed', src: null });
    list.pressR(['a.ts', 'src', 'b.ts']);
    expect(list.toggled).toEqual([['a.ts', 'b.ts']]);
    expect(list.moves()).toBe(0);
  });

  it('does nothing on folders only', () => {
    const list = reviewList({ src: null });
    list.pressR(['src']);
    expect(list.toggled).toEqual([]);
    expect(list.moves()).toBe(0);
  });
});
