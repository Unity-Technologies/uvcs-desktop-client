import { describe, expect, it } from 'vitest';
import type { KeyboardEvent } from 'react';
import type { GroupedTreeRow } from '../../lib/groupedPathTree';
import { isReviewKey, stepToNextReviewable, toggleReviewedFromKey } from './reviewKey';
import type { ReviewStatus } from './reviewStatus';
import type { ListReview } from './useReviewMode';

type Row = GroupedTreeRow<string, unknown>;

const file = (path: string): Row => ({ type: 'file', key: path, item: path, depth: 0 });
const folder = (path: string, items: string[], collapsed = false): Row => ({ type: 'folder', key: path, path, name: path, depth: 0, items, collapsed });
const group = (label: string, items: string[], collapsed = false): Row => ({ type: 'group', key: label, label, group: label, items, collapsed });

/**
 * A list of files with their marks, shown one row each unless `rows` says otherwise; directories (null) have nothing
 * to review. R toggles like the list does, from the row of the first item selected, and records the steps it moves.
 */
function reviewList(marks: Record<string, ReviewStatus | null>, rows: Row[] = Object.keys(marks).map(file)) {
  const toggled: string[][] = [];
  const steps: number[] = [];
  const review: ListReview<string> = {
    on: true,
    statusOf: (path) => marks[path] ?? null,
    toggle: (paths) => void toggled.push(paths),
  };
  const pressR = (selected: string[]) =>
    toggleReviewedFromKey(review, selected, { rows, focusedIndex: rows.findIndex((row) => row.key === selected[0]), moveBy: (step) => void steps.push(step) });
  return { pressR, toggled, steps, moves: () => steps.length };
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
    const list = reviewList({ 'a.ts': 'unreviewed', 'b.ts': 'changedSinceReview', 'c.ts': 'unreviewed' });
    list.pressR(['a.ts']);
    list.pressR(['b.ts']);
    expect(list.toggled).toEqual([['a.ts'], ['b.ts']]);
    expect(list.steps).toEqual([1, 1]);
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

describe('Where R moves after marking a file', () => {
  it('passes directories, which have nothing to review', () => {
    const list = reviewList({ 'a.ts': 'unreviewed', 'new dir': null, 'other dir': null, 'b.ts': 'unreviewed' });
    list.pressR(['a.ts']);
    expect(list.steps).toEqual([3]);
  });

  it('passes files already reviewed, so R, R, R never clears a mark', () => {
    const list = reviewList({ 'a.ts': 'unreviewed', 'b.ts': 'reviewed', 'c.ts': 'changedSinceReview' });
    list.pressR(['a.ts']);
    expect(list.steps).toEqual([2]);
  });

  it('passes an open group, to its first file', () => {
    const statusOf = (path: string) => (path.endsWith('.ts') ? 'unreviewed' : null);
    expect(stepToNextReviewable([file('a.ts'), group('Default', ['b.ts']), file('b.ts')], 0, statusOf)).toBe(2);
  });

  it('passes a closed folder whose files are all reviewed', () => {
    const statusOf = (path: string) => (path === 'a.ts' || path === 'c.ts' ? 'unreviewed' : 'reviewed');
    expect(stepToNextReviewable([file('a.ts'), folder('done', ['done/b.ts'], true), file('c.ts')], 0, statusOf)).toBe(2);
  });

  it('stays on the last file when only directories follow', () => {
    const list = reviewList({ 'a.ts': 'unreviewed', 'new dir': null });
    list.pressR(['a.ts']);
    expect(list.toggled).toEqual([['a.ts']]);
    expect(list.steps).toEqual([]);
  });

  it('goes into an open folder, to its first file', () => {
    const marks = { 'a.ts': 'unreviewed', 'src/b.ts': 'unreviewed' } as const;
    const statusOf = (path: string) => marks[path as keyof typeof marks] ?? null;
    expect(stepToNextReviewable([file('a.ts'), folder('src', ['src/b.ts']), file('src/b.ts')], 0, statusOf)).toBe(2);
  });

  it('stops on a closed folder or group holding files to review, whose files are hidden', () => {
    const statusOf = (path: string) => (path.endsWith('.ts') ? 'unreviewed' : null);
    expect(stepToNextReviewable([file('a.ts'), folder('src', ['src/b.ts'], true)], 0, statusOf)).toBe(1);
    expect(stepToNextReviewable([file('a.ts'), group('Default', ['b.ts'], true)], 0, statusOf)).toBe(1);
  });

  it('passes a closed folder holding only directories', () => {
    const statusOf = (path: string) => (path.endsWith('.ts') ? 'unreviewed' : null);
    expect(stepToNextReviewable([file('a.ts'), folder('dirs', ['dirs/new'], true), file('b.ts')], 0, statusOf)).toBe(2);
  });
});
