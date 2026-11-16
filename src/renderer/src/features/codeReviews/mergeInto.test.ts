import { describe, expect, it } from 'vitest';
import { repositoryPlace, workspacePlace } from '@shared/domain/place';
import type { MergeRequestState } from '@shared/domain/codeReview';
import { codeReviewSummary } from '../../testing/codeReviewSummary';
import { mergeIntoOf, mergeOfRequest } from './mergeInto';

const onTask = { kind: 'branch', branch: '/main/task1' } as const;
const request = (state: MergeRequestState, destination = '/main') => codeReviewSummary({ id: 12, title: 'Add login', target: onTask, mergeRequest: { state, destination } });

describe('mergeOfRequest', () => {
  it("merges an open request's branch into its destination, named by its own name", () => {
    expect(mergeOfRequest(request('Open', '/main/release'))).toEqual({
      request: { id: 12, title: 'Add login', mergeRequest: { state: 'Open', destination: '/main/release' } },
      source: '/main/task1',
      label: 'Merge into release…',
    });
  });

  it("offers nothing for a draft, a merged or a closed one, a code review, or a branch whose name isn't read", () => {
    for (const state of ['Draft', 'Merged', 'Closed'] as const) expect(mergeOfRequest(request(state))).toBeUndefined();
    expect(mergeOfRequest(codeReviewSummary({ id: 9, target: onTask }))).toBeUndefined();
    expect(mergeOfRequest({ ...request('Open'), target: undefined })).toBeUndefined();
  });
});

describe('mergeIntoOf', () => {
  it('is offered by the menus only in a window with a workspace, where the merge page runs', () => {
    expect(mergeIntoOf(workspacePlace('/ws'), request('Open'))).toEqual(mergeOfRequest(request('Open')));
    expect(mergeIntoOf(repositoryPlace('game@local'), request('Open'))).toBeUndefined();
  });
});
