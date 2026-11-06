import { describe, expect, it } from 'vitest';
import type { CodeReviewSummary } from '@shared/domain/codeReview';
import { codeReviewSummary } from '../../testing/codeReviewSummary';
import { taskEnding, taskMergeOf, type TaskMerge } from './taskMerge';

const branch = { id: 7, name: '/main/task001', parent: '/main', comment: 'Add the login screen' };
const review = (status: CodeReviewSummary['status']): CodeReviewSummary => codeReviewSummary({ id: 12, title: 'Task 001', owner: 'ana', reviewers: [{ name: 'bob', status }] });
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
  it("marks the user's review and hides the branch as picked", () => {
    expect(taskEnding({ task: picked(true, true), review: review('Under review'), user: 'bob' })).toEqual({
      taskBranch: '/main/task001',
      review: review('Under review'),
      hideBranch: true,
    });
  });

  it("leaves the review alone when not picked, already marked by the user, missing, or when the user isn't a reviewer", () => {
    expect(taskEnding({ task: picked(false, false), review: review('Rework required'), user: 'bob' }).review).toBeUndefined();
    expect(taskEnding({ task: picked(true, false), review: review('Reviewed'), user: 'bob' }).review).toBeUndefined();
    expect(taskEnding({ task: picked(true, false), review: undefined, user: 'bob' }).review).toBeUndefined();
    expect(taskEnding({ task: picked(true, false), review: review('Under review'), user: 'eva' }).review).toBeUndefined();
  });
});
