import { describe, expect, it } from 'vitest';
import type { CodeReviewTarget, MergeRequestInfo } from '@shared/domain/codeReview';
import { describeMerge, isActiveMergeRequest, MERGE_REQUEST_STATE_ICONS, mergeRequestTip, reviewedChangesOf, reviewNoun } from './mergeRequestState';

const request = (state: MergeRequestInfo['state'], destination = '/main'): { mergeRequest: MergeRequestInfo } => ({ mergeRequest: { state, destination } });

describe('merge request state', () => {
  it('is active while Open or Draft, never Merged, Closed or for a plain review', () => {
    expect([request('Open'), request('Draft'), request('Merged'), request('Closed'), {}].map(isActiveMergeRequest)).toEqual([true, true, false, false, false]);
  });

  it('gives each state a glyph of its own, so color never tells it alone', () => {
    expect(new Set(Object.values(MERGE_REQUEST_STATE_ICONS)).size).toBe(4);
  });

  it('names the state and the destination in its tooltip', () => {
    expect([request('Open'), request('Draft', '/main/release'), request('Merged'), request('Closed')].map(mergeRequestTip)).toEqual([
      'Open merge request into /main',
      'Draft merge request into /main/release',
      'Merged into /main',
      'Closed merge request into /main',
    ]);
  });

  it('describes a merge as its source into its destination', () => {
    expect(describeMerge('/main/task', request('Open', '/main'))).toBe('/main/task → /main');
    expect(describeMerge('/main/task', {})).toBe('/main/task');
  });
});

describe('what a review is called and what its changes show', () => {
  const branch: CodeReviewTarget = { kind: 'branch', branch: '/main/task' };

  it('calls a merge request one, and anything else a code review', () => {
    expect([reviewNoun(request('Closed')), reviewNoun({})]).toEqual(['Merge request', 'Code review']);
  });

  it("shows a merge request's branch into its destination, a branch, or the changes it reviews in words", () => {
    expect(reviewedChangesOf({ target: branch, ...request('Open') })).toEqual({ kind: 'merge', source: '/main/task', destination: '/main' });
    expect(reviewedChangesOf({ target: branch })).toEqual({ kind: 'branch', branch: '/main/task' });
    expect(reviewedChangesOf({ target: { kind: 'changeset', changesetId: 4 } })).toEqual({ kind: 'text', text: 'Changeset 4' });
  });
});
