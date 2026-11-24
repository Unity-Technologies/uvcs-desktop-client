import { describe, expect, it } from 'vitest';
import { codeReviewSummary } from '../../testing/codeReviewSummary';
import type { CodeReviewTarget, MergeRequestInfo } from '@shared/domain/codeReview';
import { asMergeRequest, isActiveMergeRequest, MERGE_REQUEST_STATE_ICONS, mergeRequestMoves, mergeRequestTip, moveFailureTitle, reviewedChangesOf, reviewedChangesTip, reviewNoun } from './mergeRequestState';

const request = (state: MergeRequestInfo['state'], destination = '/main'): { mergeRequest: MergeRequestInfo } => ({ mergeRequest: { state, destination } });

describe('asMergeRequest', () => {
  it('types a merge request as one, and gives none for a plain code review or no review', () => {
    const review = codeReviewSummary({ id: 1 });
    expect(asMergeRequest({ ...review, ...request('Open') })?.mergeRequest).toEqual({ state: 'Open', destination: '/main' });
    expect(asMergeRequest(review)).toBeUndefined();
    expect(asMergeRequest(undefined)).toBeUndefined();
  });
});

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

  it('offers the moves each state can take, in their words, and none once merged', () => {
    const moves = (state: MergeRequestInfo['state']) => mergeRequestMoves(state).map(({ to, word }) => `${word} → ${to}`);

    expect(moves('Draft')).toEqual(['readyForReview → Open', 'closeMergeRequest → Closed']);
    expect(moves('Open')).toEqual(['convertToDraft → Draft', 'closeMergeRequest → Closed']);
    expect(moves('Closed')).toEqual(['reopenMergeRequest → Open']);
    expect(moves('Merged')).toEqual([]);
  });

  it('names what failed for each move', () => {
    expect(mergeRequestMoves('Draft').map(moveFailureTitle)).toEqual(["Couldn't mark the merge request ready for review", "Couldn't close the merge request"]);
    expect(mergeRequestMoves('Open').map(moveFailureTitle)).toEqual(["Couldn't convert the merge request to a draft", "Couldn't close the merge request"]);
    expect(mergeRequestMoves('Closed').map(moveFailureTitle)).toEqual(["Couldn't reopen the merge request"]);
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

  it('says in the tooltip who wants to merge which whole branch into which, as the column shows only their names', () => {
    const nested: CodeReviewTarget = { kind: 'branch', branch: '/main/scm1/scm2' };
    const tip = (state: MergeRequestInfo['state']) => reviewedChangesTip({ target: nested, owner: 'jane.doe@unity3d.com', ...request(state, '/main/scm1') });
    expect([tip('Open'), tip('Draft'), tip('Merged'), tip('Closed')]).toEqual([
      'Jane Doe wants to merge /main/scm1/scm2 into /main/scm1',
      'Jane Doe wants to merge /main/scm1/scm2 into /main/scm1',
      'Merged /main/scm1/scm2 into /main/scm1',
      'Jane Doe wanted to merge /main/scm1/scm2 into /main/scm1',
    ]);
  });

  it("names a reviewed branch whole in the tooltip, and gives none for changes said in words", () => {
    expect(reviewedChangesTip({ target: branch, owner: 'jane' })).toBe('/main/task');
    expect(reviewedChangesTip({ target: { kind: 'changeset', changesetId: 4 }, owner: 'jane' })).toBeUndefined();
  });
});
