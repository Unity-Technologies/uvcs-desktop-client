import { describe, expect, it } from 'vitest';
import type { CodeReviewer } from '@shared/domain/codeReview';
import { changesOwnStatus, isReviewer, ownStatus, reviewerNames, reviewerRing, reviewersText, reviewerText, shownReviewers } from './reviewers';

const ANA: CodeReviewer = { name: 'ana@acme.com', status: 'Reviewed' };
const BOB: CodeReviewer = { name: 'bob@acme.com', status: 'Under review' };
const QA: CodeReviewer = { name: 'qa-team', status: 'Rework required' };
const EVA: CodeReviewer = { name: 'eva@acme.com', status: 'Under review' };

describe('shownReviewers', () => {
  it('shows the first few and leaves the rest to "+N", naming none beside them', () => {
    expect(shownReviewers([ANA, BOB, QA, EVA], 3)).toEqual({ shown: [ANA, BOB, QA], rest: [EVA] });
    expect(shownReviewers([ANA, BOB], 3)).toEqual({ shown: [ANA, BOB], rest: [] });
  });

  it('names a sole reviewer beside their avatar, and shows nobody for a review nobody was asked to', () => {
    expect(shownReviewers([ANA], 3)).toEqual({ shown: [ANA], rest: [], soleName: 'Ana' });
    expect(shownReviewers([], 3)).toEqual({ shown: [], rest: [] });
  });
});

describe('reviewerText', () => {
  it("names a reviewer with their status, for their avatar's own tooltip", () => {
    expect(reviewerText(QA)).toBe('Qa Team: Rework required');
  });
});

describe('reviewerRing', () => {
  it('rings a reviewer in the color of the status they gave, and in none while they review', () => {
    expect(reviewerRing('Reviewed')).toBe('var(--status-added)');
    expect(reviewerRing('Rework required')).toBe('var(--status-changed)');
    expect(reviewerRing('Under review')).toBeUndefined();
  });
});

describe('reviewersText', () => {
  it('names each reviewer with their status', () => {
    expect(reviewersText([ANA, QA])).toBe('Ana: Reviewed, Qa Team: Rework required');
  });

  it('says when nobody was asked', () => {
    expect(reviewersText([])).toBe('Nobody');
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

describe('changesOwnStatus', () => {
  it("changes nothing when the user picks the status they gave already", () => {
    expect(changesOwnStatus({ reviewers: [ANA] }, 'ana@acme.com', 'Reviewed')).toBe(false);
    expect(changesOwnStatus({ reviewers: [ANA] }, 'ana@acme.com', 'Rework required')).toBe(true);
  });

  it("changes something for a user who isn't a reviewer, or isn't known yet, whatever they pick", () => {
    expect(changesOwnStatus({ reviewers: [ANA] }, 'eva@acme.com', 'Under review')).toBe(true);
    expect(changesOwnStatus({ reviewers: [ANA] }, undefined, 'Under review')).toBe(true);
  });
});

describe('reviewerNames', () => {
  it('splits the names typed at commas, once each, ignoring blanks', () => {
    expect(reviewerNames(' ana, bob,,ana , ')).toEqual(['ana', 'bob']);
    expect(reviewerNames('')).toEqual([]);
  });
});
