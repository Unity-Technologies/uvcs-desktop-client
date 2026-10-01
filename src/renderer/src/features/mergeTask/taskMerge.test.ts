import { describe, expect, it } from 'vitest';
import type { CodeReviewSummary } from '@shared/domain/codeReview';
import { taskEnding, taskMergeOf, type TaskMerge } from './taskMerge';

const branch = { id: 7, name: '/main/task001', parent: '/main', comment: 'Add the login screen' };
const review = (status: CodeReviewSummary['status']): CodeReviewSummary => ({ id: 12, title: 'Task 001', status, owner: 'ana', assignee: 'bob', date: '2026-09-01' });
const picked = (markReviewed: boolean, hideBranch: boolean): TaskMerge => ({ branch, choices: { markReviewed, hideBranch } });

describe('taskMergeOf', () => {
  it('keeps only what finishing the task needs, nothing picked yet', () => {
    expect(taskMergeOf({ ...branch, owner: 'ana', date: '2026-09-01', headChangeset: 40 } as typeof branch)).toEqual({
      branch,
      choices: { markReviewed: false, hideBranch: false },
    });
  });
});

describe('taskEnding', () => {
  it('marks the review and hides the branch as picked', () => {
    expect(taskEnding({ task: picked(true, true), review: review('Under review') })).toEqual({ taskBranch: '/main/task001', review: review('Under review'), hideBranch: true });
  });

  it('leaves the review alone when not picked, already reviewed, or missing', () => {
    expect(taskEnding({ task: picked(false, false), review: review('Rework required') }).review).toBeUndefined();
    expect(taskEnding({ task: picked(true, false), review: review('Reviewed') }).review).toBeUndefined();
    expect(taskEnding({ task: picked(true, false), review: undefined }).review).toBeUndefined();
  });
});
