// The review section's words come with the merge card's, whose module reads the platform from the window.
import '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import type { CodeReviewer, CodeReviewSummary, MergeRequestState } from '@shared/domain/codeReview';
import { codeReviewSummary } from '../../testing/codeReviewSummary';
import { mergeRequestSummaryOf } from './mergeRequestSummary';
import type { MergeRequestReview } from './mergeRequestState';

const ANA_REVIEWED: CodeReviewer = { name: 'ana', status: 'Reviewed' };

function request(state: MergeRequestState, review: Partial<CodeReviewSummary> = {}): MergeRequestReview {
  return { ...codeReviewSummary({ id: 12, title: 'Add login\n\nThe long story', owner: 'leo', ...review }), mergeRequest: { state, destination: '/main' } };
}

describe('mergeRequestSummaryOf', () => {
  it('names it by its title, never its number, and says who wants it merged where', () => {
    expect(mergeRequestSummaryOf(request('Open'))).toMatchObject({ title: 'Add login', state: 'Open', owner: 'leo', verb: 'wants to merge into', destination: '/main' });
  });

  it.each([
    ['Draft', 'wants to merge into'],
    ['Merged', 'asked to merge into'],
    ['Closed', 'wanted to merge into'],
  ] as const)('a %s one %s', (state, verb) => {
    expect(mergeRequestSummaryOf(request(state)).verb).toBe(verb);
  });

  it('says where an Open one’s review stands, in the merge card’s words, with nothing to do from a summary', () => {
    expect(mergeRequestSummaryOf(request('Open', { status: 'Reviewed', reviewers: [ANA_REVIEWED] })).review).toEqual({ tone: 'passed', status: 'Reviewed', title: 'Changes reviewed', detail: '1 approving review' });
    expect(mergeRequestSummaryOf(request('Open', { reviewers: [] })).review).toEqual({ tone: 'pending', title: 'Review required', detail: 'At least 1 approving review is required' });
  });

  it('says how a merged one’s review went, once it was decided', () => {
    expect(mergeRequestSummaryOf(request('Merged', { status: 'Reviewed', reviewers: [ANA_REVIEWED] })).review?.title).toBe('Changes reviewed');
    expect(mergeRequestSummaryOf(request('Merged', { reviewers: [] })).review).toBeUndefined();
  });

  it('says nothing of a review still going on a merged one: it merged whatever the review said', () => {
    expect(mergeRequestSummaryOf(request('Merged', { status: 'Under review', reviewers: [{ name: 'ana', status: 'Under review' }] })).review).toBeUndefined();
  });

  it.each(['Draft', 'Closed'] as const)('says nothing of the review of a %s one: it is not up for review', (state) => {
    expect(mergeRequestSummaryOf(request(state, { reviewers: [ANA_REVIEWED] })).review).toBeUndefined();
  });
});
