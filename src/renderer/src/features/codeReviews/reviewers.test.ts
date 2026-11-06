import { describe, expect, it } from 'vitest';
import type { CodeReviewer } from '@shared/domain/codeReview';
import { isReviewer, ownStatus, reviewerNames, reviewersText, shownReviewers } from './reviewers';

const ANA: CodeReviewer = { name: 'ana@acme.com', status: 'Reviewed' };
const BOB: CodeReviewer = { name: 'bob@acme.com', status: 'Under review' };
const QA: CodeReviewer = { name: 'qa-team', status: 'Rework required' };
const EVA: CodeReviewer = { name: 'eva@acme.com', status: 'Under review' };

describe('shownReviewers', () => {
  it('shows the first few and counts the rest', () => {
    expect(shownReviewers([ANA, BOB, QA, EVA], 3)).toEqual({ shown: [ANA, BOB, QA], more: 1 });
  });

  it('shows everyone when they fit, and nobody for a review nobody was asked to', () => {
    expect(shownReviewers([ANA], 3)).toEqual({ shown: [ANA], more: 0 });
    expect(shownReviewers([], 3)).toEqual({ shown: [], more: 0 });
  });
});

describe('reviewersText', () => {
  it('names each reviewer with their status', () => {
    expect(reviewersText([ANA, QA])).toBe('Ana: Reviewed, Qa Team: Rework required');
  });

  it('says when nobody was asked', () => {
    expect(reviewersText([])).toBe('Nobody asked yet');
  });
});

describe('isReviewer', () => {
  it('finds the user among the reviewers, whatever the case cm wrote either in', () => {
    expect(isReviewer({ reviewers: [ANA, BOB] }, 'Bob@Acme.com')).toBe(true);
    expect(isReviewer({ reviewers: [ANA, BOB] }, 'eva@acme.com')).toBe(false);
  });

  it('answers no while the user is unknown', () => {
    expect(isReviewer({ reviewers: [ANA] }, undefined)).toBe(false);
  });
});

describe('ownStatus', () => {
  it('is the status the user gave as a reviewer', () => {
    expect(ownStatus({ reviewers: [ANA, BOB] }, 'ANA@acme.com')).toBe('Reviewed');
  });

  it("is none for a user who isn't a reviewer, or isn't known yet", () => {
    expect(ownStatus({ reviewers: [ANA] }, 'eva@acme.com')).toBeUndefined();
    expect(ownStatus({ reviewers: [ANA] }, undefined)).toBeUndefined();
  });
});

describe('reviewerNames', () => {
  it('splits the names typed at commas, once each, ignoring blanks', () => {
    expect(reviewerNames(' ana, bob,,ana , ')).toEqual(['ana', 'bob']);
    expect(reviewerNames('')).toEqual([]);
  });
});
