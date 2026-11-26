import { describe, expect, it } from 'vitest';
import type { CodeReviewSummary } from './codeReview';
import { branchTargetIdsOf, withTargetNamed } from './reviewTargetNames';

const summary = (fields: Partial<CodeReviewSummary>): CodeReviewSummary => ({
  id: 1,
  title: 'Review',
  status: 'Under review',
  owner: 'ana',
  reviewers: [],
  date: '',
  lastActivity: '',
  commentCount: 0,
  openIssueCount: 0,
  ...fields,
});

describe('branchTargetIdsOf', () => {
  it('asks for each branch once, and for nothing a changeset or shelve review targets', () => {
    const reviews = [
      summary({ targetBranchId: 37 }),
      summary({ target: { kind: 'changeset', changesetId: 120 } }),
      summary({ targetBranchId: 37 }),
      summary({ targetBranchId: 41 }),
      summary({ target: { kind: 'shelve', shelveId: 3 } }),
    ];
    expect(branchTargetIdsOf(reviews)).toEqual([37, 41]);
  });

  it('asks for nothing when no review targets a branch', () => {
    expect(branchTargetIdsOf([])).toEqual([]);
  });
});

describe('withTargetNamed', () => {
  const names = { 37: '/main/tâche-日本' };

  it('names a branch target by its id', () => {
    expect(withTargetNamed(summary({ targetBranchId: 37 }), names).target).toEqual({ kind: 'branch', branch: '/main/tâche-日本' });
  });

  it('shows a branch with no name, deleted since, as an unknown branch', () => {
    expect(withTargetNamed(summary({ targetBranchId: 99 }), names).target).toEqual({ kind: 'unknown', description: 'an unknown branch' });
  });

  it('keeps a changeset or shelve target as listed', () => {
    const target = { kind: 'changeset', changesetId: 120 } as const;
    expect(withTargetNamed(summary({ target }), names).target).toEqual(target);
  });

  it('shows a target of no kind it knows as changes of an unknown kind', () => {
    expect(withTargetNamed(summary({}), names).target).toEqual({ kind: 'unknown', description: 'changes of an unknown kind' });
  });

  it('keeps every other field of the review', () => {
    const review = summary({ id: 5, title: 'Fix', targetBranchId: 37, mergeRequest: { state: 'Open', destination: '/main' } });
    expect(withTargetNamed(review, names)).toEqual({ ...review, target: { kind: 'branch', branch: '/main/tâche-日本' } });
  });
});
