// The review section's words come with the merge card's, whose module reads the platform from the window.
import '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import type { CodeReviewer, CodeReviewStatus, MergeRequestState } from '@shared/domain/codeReview';
import { codeReviewSummary } from '../../testing/codeReviewSummary';
import type { MergeRequestReview } from './mergeRequestState';
import { listedVerdictOf } from './listedVerdict';
import { verdictOfSections } from './mergeVerdict';

const reviewer = (status: CodeReviewStatus): CodeReviewer => ({ name: 'ana', status });
const request = (state: MergeRequestState, status: CodeReviewStatus, reviewers = [reviewer(status)]): MergeRequestReview => ({
  ...codeReviewSummary({ id: 1, status, reviewers }),
  mergeRequest: { state, destination: '/main' },
});

describe('verdictOfSections', () => {
  it('is blocked by any failed section, whatever else passed', () => {
    expect(verdictOfSections([{ tone: 'passed' }, { tone: 'failed' }])).toBe('blocked');
  });

  it('is ready when one passed and the rest passed or say nothing yet', () => {
    expect(verdictOfSections([{ tone: 'passed' }, { tone: 'neutral' }])).toBe('ready');
  });

  it('waits while a section is pending, or none passed', () => {
    expect(verdictOfSections([{ tone: 'passed' }, { tone: 'pending' }])).toBe('waiting');
    expect(verdictOfSections([{ tone: 'neutral' }])).toBe('waiting');
  });
});

describe('listedVerdictOf', () => {
  it('is ready once an Open request is reviewed, blocked once changes are required', () => {
    expect(listedVerdictOf(request('Open', 'Reviewed'))).toBe('ready');
    expect(listedVerdictOf(request('Open', 'Rework required'))).toBe('blocked');
  });

  it('waits while the review is under way, or nobody reviews it', () => {
    expect(listedVerdictOf(request('Open', 'Under review'))).toBe('waiting');
    expect(listedVerdictOf(request('Open', 'Under review', []))).toBe('waiting');
  });

  it.each(['Draft', 'Merged', 'Closed'] as const)('says nothing for a %s request', (state) => {
    expect(listedVerdictOf(request(state, 'Reviewed'))).toBeUndefined();
  });
});
