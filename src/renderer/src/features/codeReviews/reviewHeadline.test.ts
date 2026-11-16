import { describe, expect, it } from 'vitest';
import type { MergeRequestState } from '@shared/domain/codeReview';
import { reviewHeadline } from './reviewHeadline';

const request = (state: MergeRequestState) => ({ mergeRequest: { state, destination: '/main' } });

describe('reviewHeadline', () => {
  it('says a code review wants a review of what it targets, with no destination', () => {
    expect(reviewHeadline({})).toEqual({ verb: 'wants a review of' });
  });

  it('says a merge request still to merge wants to merge into a destination that can still change', () => {
    expect(reviewHeadline(request('Open'))).toEqual({ verb: 'wants to merge', destination: { name: '/main', editable: true } });
    expect(reviewHeadline(request('Draft'))).toEqual({ verb: 'wants to merge', destination: { name: '/main', editable: true } });
  });

  it('says a merged or closed one in the past, its destination settled', () => {
    expect(reviewHeadline(request('Merged'))).toEqual({ verb: 'merged', destination: { name: '/main', editable: false } });
    expect(reviewHeadline(request('Closed'))).toEqual({ verb: 'wanted to merge', destination: { name: '/main', editable: false } });
  });
});
