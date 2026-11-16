// The review section's words come with the merge card's, whose module reads the platform from the window.
import '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import type { CodeReviewStatus, MergeRequestState } from '@shared/domain/codeReview';
import { codeReviewSummary } from '../../testing/codeReviewSummary';
import { reviewStatusCellOf } from './reviewStatusCell';

const plain = (status: CodeReviewStatus) => codeReviewSummary({ id: 1, status, reviewers: [{ name: 'ana', status }] });
const request = (state: MergeRequestState, status: CodeReviewStatus) => ({ ...plain(status), mergeRequest: { state, destination: '/main' } });

describe("the icon after a row's title", () => {
  it('shows a merge request as by a branch: whether it can merge, its state leading the row', () => {
    expect(reviewStatusCellOf(request('Open', 'Reviewed'))).toEqual({ kind: 'mergeRequest', verdict: 'ready' });
    expect(reviewStatusCellOf(request('Open', 'Rework required'))).toEqual({ kind: 'mergeRequest', verdict: 'blocked' });
    expect(reviewStatusCellOf(request('Open', 'Under review'))).toEqual({ kind: 'mergeRequest' });
    expect(reviewStatusCellOf(request('Merged', 'Reviewed'))).toEqual({ kind: 'mergeRequest' });
  });

  it('shows a code review by its review status', () => {
    expect(reviewStatusCellOf(plain('Under review'))).toEqual({ kind: 'codeReview', status: 'Under review' });
  });
});
