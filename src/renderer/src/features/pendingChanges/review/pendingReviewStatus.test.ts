import { describe, expect, it } from 'vitest';
import type { PendingChange } from '@shared/domain/pendingChanges';
import type { ReviewMark } from '@shared/domain/review';
import { pendingReviewStatusOf } from './pendingReviewStatus';

const file = (path: string, kinds: PendingChange['kinds'] = ['changed']): PendingChange => ({ path, kinds, itemType: 'file', size: 0, lastModified: '' });

describe('pendingReviewStatusOf', () => {
  it('reads files by their marks, and leaves folders out', () => {
    const marks = new Map<string, ReviewMark>([
      ['a.ts', { path: 'a.ts', state: 'reviewed', hasSnapshot: true }],
      ['b.ts', { path: 'b.ts', state: 'changedSinceReview', hasSnapshot: false }],
    ]);
    const statusOf = pendingReviewStatusOf(marks);
    expect([file('a.ts'), file('b.ts'), file('c.ts')].map(statusOf)).toEqual(['reviewed', 'changedSinceReview', 'unreviewed']);
    expect(statusOf({ ...file('src'), itemType: 'directory' })).toBeNull();
  });

  it('leaves out files shown only for reference, which are not checked in', () => {
    const statusOf = pendingReviewStatusOf(new Map());
    expect([file('out.log', ['ignored']), file('big.bin', ['cloaked']), file('new.ts', ['private'])].map(statusOf)).toEqual([null, null, 'unreviewed']);
  });
});
