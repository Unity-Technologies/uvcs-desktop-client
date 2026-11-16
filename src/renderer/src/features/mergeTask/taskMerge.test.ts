import { describe, expect, it } from 'vitest';
import type { CodeReviewSummary, MergeRequestState } from '@shared/domain/codeReview';
import { codeReviewSummary } from '../../testing/codeReviewSummary';
import { mergeRequestMergeOf, requestsToRecord, taskEnding, taskMergeOf, type TaskMerge } from './taskMerge';

const branch = { name: '/main/task001', comment: 'Add the login screen' };
const review = (status: CodeReviewSummary['status']): CodeReviewSummary => codeReviewSummary({ id: 12, title: 'Task 001', owner: 'ana', reviewers: [{ name: 'bob', status }] });
const picked = (markReviewed: boolean, hideBranch: boolean): TaskMerge => ({ branch, choices: { markReviewed, hideBranch } });

describe('taskMergeOf', () => {
  it('keeps only what finishing the task needs, nothing picked yet', () => {
    expect(taskMergeOf({ ...branch, id: 7, parent: '/main', owner: 'ana', date: '2026-09-01', headChangeset: 40 } as typeof branch)).toEqual({
      branch,
      choices: { markReviewed: false, hideBranch: false },
    });
  });
});

describe('mergeRequestMergeOf', () => {
  it("merges a merge request's branch, naming the request", () => {
    const request = { ...codeReviewSummary({ id: 12, title: 'Add login' }), mergeRequest: { state: 'Open', destination: '/main' } } as const;

    expect(mergeRequestMergeOf(request, '/main/release/task')).toEqual({
      branch: { name: '/main/release/task', comment: '' },
      mergeRequest: { id: 12, title: 'Add login' },
      choices: { markReviewed: false, hideBranch: false },
    });
  });
});

describe('requestsToRecord', () => {
  const request = (id: number, state: MergeRequestState, destination = '/main') => codeReviewSummary({ id, mergeRequest: { state, destination } });

  it('records the Open merge requests of the branch into that destination', () => {
    expect(requestsToRecord([request(12, 'Open'), request(9, 'Open')], '/main')).toEqual([12, 9]);
  });

  it("leaves drafts, closed and merged ones, another destination's and plain code reviews alone", () => {
    const reviews = [request(1, 'Draft'), request(2, 'Closed'), request(3, 'Merged'), request(4, 'Open', '/main/release'), codeReviewSummary({ id: 5 })];

    expect(requestsToRecord(reviews, '/main')).toEqual([]);
  });

  it("falls back to the request the merge was opened from while the branch's reviews aren't read", () => {
    expect(requestsToRecord(undefined, '/main', { id: 12, title: 'Add login' })).toEqual([12]);
    expect(requestsToRecord(undefined, '/main')).toEqual([]);
  });
});

describe('taskEnding', () => {
  it("records its merge requests, marks the user's review and hides the branch as picked", () => {
    expect(taskEnding({ task: picked(true, true), review: review('Under review'), user: 'bob', mergeRequests: [12] })).toEqual({
      taskBranch: '/main/task001',
      mergeRequests: [12],
      review: review('Under review'),
      hideBranch: true,
    });
  });

  it("leaves the review alone when not picked, already marked by the user, missing, or when the user isn't a reviewer", () => {
    expect(taskEnding({ task: picked(false, false), review: review('Rework required'), user: 'bob', mergeRequests: [] }).review).toBeUndefined();
    expect(taskEnding({ task: picked(true, false), review: review('Reviewed'), user: 'bob', mergeRequests: [] }).review).toBeUndefined();
    expect(taskEnding({ task: picked(true, false), review: undefined, user: 'bob', mergeRequests: [] }).review).toBeUndefined();
    expect(taskEnding({ task: picked(true, false), review: review('Under review'), user: 'eva', mergeRequests: [] }).review).toBeUndefined();
  });
});
