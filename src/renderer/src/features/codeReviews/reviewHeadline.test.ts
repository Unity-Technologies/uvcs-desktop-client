import { describe, expect, it } from 'vitest';
import type { CodeReviewTarget, MergeRequestState } from '@shared/domain/codeReview';
import { reviewHeadline } from './reviewHeadline';

const ON_BRANCH: CodeReviewTarget = { kind: 'branch', branch: '/main/task' };
const request = (state: MergeRequestState, target: CodeReviewTarget = ON_BRANCH) => ({ target, mergeRequest: { state, destination: '/main' } });

describe('reviewHeadline', () => {
  it('says a code review wants a review of what it targets, with no destination', () => {
    expect(reviewHeadline({ target: ON_BRANCH })).toEqual({ verb: 'wants a review of' });
  });

  it('says a merge request still to merge wants to merge into a destination that can still change', () => {
    expect(reviewHeadline(request('Open'))).toEqual({ verb: 'wants to merge', destination: { name: '/main', editable: true, source: '/main/task' } });
    expect(reviewHeadline(request('Draft'))).toEqual({ verb: 'wants to merge', destination: { name: '/main', editable: true, source: '/main/task' } });
  });

  it('says a merged or closed one asked to merge, its destination settled: the author merged nothing, whoever did', () => {
    expect(reviewHeadline(request('Merged'))).toEqual({ verb: 'asked to merge', destination: { name: '/main', editable: false } });
    expect(reviewHeadline(request('Closed'))).toEqual({ verb: 'wanted to merge', destination: { name: '/main', editable: false } });
  });

  it("doesn't let the destination change when the source branch's name couldn't be read", () => {
    expect(reviewHeadline(request('Open', { kind: 'unknown', description: 'an unknown branch' })).destination?.editable).toBe(false);
  });
});
