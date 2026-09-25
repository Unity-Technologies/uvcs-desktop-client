import { describe, expect, it } from 'vitest';
import type { PendingChange } from '@shared/domain/pendingChanges';
import type { ReviewMark } from '@shared/domain/review';
import { hasChangesSinceReview, needsReview, reviewProgress, shouldMarkReviewed } from './reviewProgress';

const file = (path: string): PendingChange => ({ path, kinds: ['changed'], itemType: 'file', size: 0, lastModified: '' });
const folder = (path: string): PendingChange => ({ ...file(path), kinds: ['added'], itemType: 'directory' });

const marks = new Map<string, ReviewMark>([
  ['a.ts', { path: 'a.ts', state: 'reviewed', hasSnapshot: true }],
  ['b.ts', { path: 'b.ts', state: 'changedSinceReview', hasSnapshot: true }],
  ['c.bin', { path: 'c.bin', state: 'changedSinceReview', hasSnapshot: false }],
]);

describe('review progress', () => {
  it('counts reviewed files, not folders, and not files changed since their review', () => {
    expect(reviewProgress([file('a.ts'), file('b.ts'), file('d.ts'), folder('src')], marks)).toEqual({ total: 3, reviewed: 1 });
  });

  it('asks to review what was never reviewed or changed since', () => {
    expect(needsReview(marks, file('a.ts'))).toBe(false);
    expect(needsReview(marks, file('b.ts'))).toBe(true);
    expect(needsReview(marks, file('d.ts'))).toBe(true);
    expect(needsReview(marks, folder('src'))).toBe(false);
  });

  it('offers the changes since the review only when the reviewed text was kept', () => {
    expect(hasChangesSinceReview(marks, file('b.ts'))).toBe(true);
    expect(hasChangesSinceReview(marks, file('c.bin'))).toBe(false);
    expect(hasChangesSinceReview(marks, file('a.ts'))).toBe(false);
  });

  it('marks a selection unless all of it is reviewed already', () => {
    expect(shouldMarkReviewed([file('a.ts'), file('b.ts')], marks)).toBe(true);
    expect(shouldMarkReviewed([file('a.ts')], marks)).toBe(false);
  });
});
