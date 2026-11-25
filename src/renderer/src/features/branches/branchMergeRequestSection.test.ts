import { describe, expect, it } from 'vitest';
import type { MergeRequestInfo } from '@shared/domain/codeReview';
import { codeReviewSummary } from '../../testing/codeReviewSummary';
import { branchMergeRequestSectionOf } from './branchMergeRequestSection';

const task = { name: '/main/task', parent: '/main' };
const plainReview = codeReviewSummary({ id: 7 });
const request = (state: MergeRequestInfo['state']) => codeReviewSummary({ id: 8, mergeRequest: { state, destination: '/main' } });

describe('the Merge request section of a branch details', () => {
  it('shows the card of a merge request still to merge, with nothing to create', () => {
    for (const state of ['Open', 'Draft'] as const) {
      expect(branchMergeRequestSectionOf(task, request(state))).toEqual({ body: 'card', request: request(state), canCreate: false });
    }
  });

  it('offers a new one beside a merged or closed request, which leaves the branch none to merge', () => {
    for (const state of ['Merged', 'Closed'] as const) {
      expect(branchMergeRequestSectionOf(task, request(state))).toEqual({ body: 'card', request: request(state), canCreate: true });
    }
  });

  it('offers a new one when the branch has none, or only a plain code review', () => {
    expect(branchMergeRequestSectionOf(task, null)).toEqual({ body: 'none', canCreate: true });
    expect(branchMergeRequestSectionOf(task, plainReview)).toEqual({ body: 'none', canCreate: true });
  });

  it('waits while the branch review is read, so the section keeps its place', () => {
    expect(branchMergeRequestSectionOf(task, undefined)).toEqual({ body: 'reading', canCreate: false });
  });

  it('hides for a branch with nowhere to merge, unless it holds a request anyway', () => {
    const main = { name: '/main', parent: '' };
    expect([undefined, null, plainReview].map((review) => branchMergeRequestSectionOf(main, review))).toEqual([{ body: 'hidden' }, { body: 'hidden' }, { body: 'hidden' }]);
    expect(branchMergeRequestSectionOf(main, request('Closed'))).toEqual({ body: 'card', request: request('Closed'), canCreate: false });
  });

  it('counts a top-level branch with a parent as one that can merge', () => {
    expect(branchMergeRequestSectionOf({ name: '/release', parent: '/main' }, null)).toEqual({ body: 'none', canCreate: true });
  });
});
