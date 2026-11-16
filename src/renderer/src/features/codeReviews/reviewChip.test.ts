import { describe, expect, it } from 'vitest';
import { codeReviewSummary } from '../../testing/codeReviewSummary';
import type { CodeReviewStatus, MergeRequestState } from '@shared/domain/codeReview';
import { reviewChipOf } from './reviewChip';

const plain = (status: CodeReviewStatus) => codeReviewSummary({ id: 12, title: 'Add login', status });
const request = (state: MergeRequestState, status: CodeReviewStatus) => ({ ...plain(status), mergeRequest: { state, destination: '/main' } });

describe("a branch's review chip", () => {
  it("shows a code review's status as today", () => {
    expect(reviewChipOf(plain('Under review'), false)).toMatchObject({ state: undefined, status: 'Under review', statusText: true });
    expect(reviewChipOf(plain('Reviewed'), true)).toMatchObject({ state: undefined, status: 'Reviewed', statusText: false });
  });

  it("leads a merge request's review status with its state", () => {
    expect(reviewChipOf(request('Open', 'Under review'), false)).toMatchObject({ state: 'Open', status: 'Under review', statusText: true });
  });

  it('shows only the state when narrow, until an Open request is reviewed: then only the thumbs-up, as it can merge', () => {
    expect(reviewChipOf(request('Open', 'Under review'), true)).toMatchObject({ state: 'Open', status: undefined, statusText: false });
    expect(reviewChipOf(request('Draft', 'Reviewed'), true)).toMatchObject({ state: 'Draft', status: undefined });
    expect(reviewChipOf(request('Merged', 'Reviewed'), true)).toMatchObject({ state: 'Merged', status: undefined });
    expect(reviewChipOf(request('Open', 'Reviewed'), true)).toMatchObject({ state: undefined, status: 'Reviewed' });
  });

  it('names what it is and where it merges in its tooltip and for a screen reader', () => {
    expect(reviewChipOf(request('Open', 'Rework required'), false)).toMatchObject({
      tipSub: 'Merge request 12 · Open into /main · Rework required · click to open',
      label: 'Open merge request 12: Add login',
    });
    expect(reviewChipOf(plain('Reviewed'), false)).toMatchObject({ tipSub: 'Code review 12 · Reviewed · click to open', label: 'Open code review 12: Add login' });
  });
});
