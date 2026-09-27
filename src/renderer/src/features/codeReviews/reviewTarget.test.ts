import { describe, expect, it } from 'vitest';
import { describeTarget, reviewDiffTarget } from './reviewTarget';

describe('review targets', () => {
  it('reviews a shelve through its diff', () => {
    expect(describeTarget({ kind: 'shelve', shelveId: 3 })).toBe('Shelve 3');
    expect(reviewDiffTarget({ kind: 'shelve', shelveId: 3 })).toEqual({ kind: 'shelve', shelveId: 3 });
  });

  it('diffs branches and changesets, and nothing it cannot name', () => {
    expect(reviewDiffTarget({ kind: 'branch', branch: '/main/task' })).toEqual({ kind: 'branch', branch: '/main/task' });
    expect(reviewDiffTarget({ kind: 'changeset', changesetId: 2 })).toEqual({ kind: 'changeset', changesetId: 2 });
    expect(reviewDiffTarget({ kind: 'unknown', description: 'an unknown branch' })).toBeNull();
    expect(describeTarget({ kind: 'unknown', description: 'an unknown branch' })).toBe('an unknown branch');
  });
});
