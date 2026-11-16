// The review section's words come with the merge card's, whose module reads the platform from the window.
import '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import type { CodeReviewStatus, MergeRequestState } from '@shared/domain/codeReview';
import { codeReviewSummary } from '../../testing/codeReviewSummary';
import { reviewStatusCellOf, reviewStatusSortValue } from './reviewStatusCell';

const plain = (status: CodeReviewStatus) => codeReviewSummary({ id: 1, status, reviewers: [{ name: 'ana', status }] });
const request = (state: MergeRequestState, status: CodeReviewStatus) => ({ ...plain(status), mergeRequest: { state, destination: '/main' } });

describe('the Status column', () => {
  it('shows a merge request as by a branch: its state, then whether it can merge', () => {
    expect(reviewStatusCellOf(request('Open', 'Reviewed'))).toEqual({ kind: 'mergeRequest', state: 'Open', verdict: 'ready' });
    expect(reviewStatusCellOf(request('Open', 'Rework required'))).toEqual({ kind: 'mergeRequest', state: 'Open', verdict: 'blocked' });
    expect(reviewStatusCellOf(request('Open', 'Under review'))).toEqual({ kind: 'mergeRequest', state: 'Open' });
    expect(reviewStatusCellOf(request('Merged', 'Reviewed'))).toEqual({ kind: 'mergeRequest', state: 'Merged' });
  });

  it('shows a code review by its review status', () => {
    expect(reviewStatusCellOf(plain('Under review'))).toEqual({ kind: 'codeReview', status: 'Under review' });
  });

  it('sorts merge requests first, by state then verdict, then code reviews', () => {
    const rows = [plain('Reviewed'), request('Closed', 'Reviewed'), request('Open', 'Rework required'), request('Open', 'Under review'), request('Open', 'Reviewed'), request('Merged', 'Reviewed')];
    const sorted = [...rows].sort((a, b) => reviewStatusSortValue(a).localeCompare(reviewStatusSortValue(b)));
    expect(sorted.map((row) => reviewStatusCellOf(row))).toEqual([
      { kind: 'mergeRequest', state: 'Open', verdict: 'ready' },
      { kind: 'mergeRequest', state: 'Open' },
      { kind: 'mergeRequest', state: 'Open', verdict: 'blocked' },
      { kind: 'mergeRequest', state: 'Merged' },
      { kind: 'mergeRequest', state: 'Closed' },
      { kind: 'codeReview', status: 'Reviewed' },
    ]);
  });
});
