import { describe, expect, it } from 'vitest';
import type { CodeReviewTarget, MergeRequestState } from '@shared/domain/codeReview';
import { changeableDestinationOf } from './changeableDestination';

const ON_BRANCH: CodeReviewTarget = { kind: 'branch', branch: '/main/task' };
const request = (state: MergeRequestState, target?: CodeReviewTarget) => ({ target, mergeRequest: { state, destination: '/main' } });

describe('changeableDestinationOf', () => {
  it('lets a draft or open merge request change where it merges, naming the branch it merges', () => {
    expect(changeableDestinationOf(request('Draft', ON_BRANCH))).toEqual({ destination: '/main', source: '/main/task' });
    expect(changeableDestinationOf(request('Open', ON_BRANCH))).toEqual({ destination: '/main', source: '/main/task' });
  });

  it('settles it once the request is merged or closed', () => {
    expect(changeableDestinationOf(request('Merged', ON_BRANCH))).toBeUndefined();
    expect(changeableDestinationOf(request('Closed', ON_BRANCH))).toBeUndefined();
  });

  it('has none for a plain code review', () => {
    expect(changeableDestinationOf({ target: ON_BRANCH })).toBeUndefined();
  });

  it("doesn't let it change when the source branch's name is unknown: deleted, or listed without it", () => {
    expect(changeableDestinationOf(request('Open', { kind: 'unknown', description: 'an unknown branch' }))).toBeUndefined();
    expect(changeableDestinationOf(request('Open'))).toBeUndefined();
  });
});
