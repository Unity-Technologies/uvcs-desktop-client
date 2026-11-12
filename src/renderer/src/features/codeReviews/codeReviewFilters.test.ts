import '../../testing/fakeWindow';
import { codeReviewSummary } from '../../testing/codeReviewSummary';
import { describe, expect, it } from 'vitest';
import type { CodeReview } from '@shared/domain/codeReview';
import { compactFilter } from '../../lib/compactFilter';
import { matchesWordFilter } from '../../lib/matchesAllWords';
import { EVERYONE, MINE } from '../../lib/peopleFilter';
import { isFiltering } from '../../lib/viewFilters';
import { codeReviewsQuery, matchesReviewer, reviewFilterTexts, reviewerChipDot, reviewerChoices } from './codeReviewFilters';
import { CLEARED_CODE_REVIEW_FILTERS, restoredReviewerFilter, useCodeReviewsViewStore } from './codeReviewsViewStore';

const today = new Date(2026, 8, 25);

describe('what Code reviews asks the server for', () => {
  it('asks by date alone with the defaults (the last three months), whatever the status or assignment left out', () => {
    expect(compactFilter(codeReviewsQuery({ since: 'last3Months', people: EVERYONE, status: 'any', reviewer: 'anyone' }, today))).toEqual({ sinceDate: '2026-06-26' });
  });

  it('reads Waiting for me from the same list as no reviewer filter, and keeps its rows locally', () => {
    const query = (reviewer: 'anyone' | 'waitingForMe') => compactFilter(codeReviewsQuery({ since: 'lastMonth', people: EVERYONE, status: 'any', reviewer }, today));
    expect(query('waitingForMe')).toEqual(query('anyone'));
  });

  it('puts who created them, the assignment and the status into the query', () => {
    expect(codeReviewsQuery({ since: 'anyTime', people: { mine: true, others: ['zoe', 'ana'] }, status: 'Reviewed', reviewer: 'me' }, today)).toEqual({
      owners: ['me', 'ana', 'zoe'],
      reviewerIsMe: true,
      status: 'Reviewed',
      sinceDate: undefined,
    });
  });
});

describe('the code reviews filter', () => {
  const review: CodeReview = {
    ...codeReviewSummary({ id: 31, title: 'Login screen', owner: 'ana.diaz', reviewers: [{ name: 'bob.smith', status: 'Reviewed' }, { name: 'qa-team', status: 'Under review' }] }),
    target: { kind: 'branch', branch: '/main/login' },
  };
  const matches = (search: string, shown = review) => matchesWordFilter(reviewFilterTexts(shown), search);

  it('looks through the number, title, target, author and every reviewer', () => {
    expect(['31', 'login screen', '/main/login', 'Ana Diaz', 'Bob Smith', 'bob.smith', 'qa-team'].every((search) => matches(search))).toBe(true);
    expect(matches('checkout')).toBe(false);
  });

  it('reads a review nobody was asked to review', () => {
    expect(matches('login', { ...review, reviewers: [] })).toBe(true);
  });
});

describe('the reviewer filter', () => {
  const asked = codeReviewSummary({ id: 1, owner: 'zoe', reviewers: [{ name: 'ana', status: 'Under review' }] });
  const reviewed = codeReviewSummary({ id: 2, owner: 'zoe', reviewers: [{ name: 'ana', status: 'Reviewed' }] });
  const ownInRework = codeReviewSummary({ id: 3, owner: 'ana', status: 'Rework required', openIssueCount: 2 });

  it('keeps, under Waiting for me, the reviews waiting for the user, their own ones in rework too', () => {
    expect([asked, reviewed, ownInRework].filter((review) => matchesReviewer(review, 'waitingForMe', 'ana')).map((review) => review.id)).toEqual([1, 3]);
  });

  it("keeps every row otherwise: I'm a reviewer is the server's to narrow", () => {
    expect([asked, reviewed, ownInRework].every((review) => matchesReviewer(review, 'anyone', 'ana') && matchesReviewer(review, 'me', 'ana'))).toBe(true);
  });

  it('keeps nothing waiting while the user is still unknown', () => {
    expect(matchesReviewer(asked, 'waitingForMe', undefined)).toBe(false);
  });
});

describe('the reviewer filter remembered by an older version', () => {
  it("reads the I'm a reviewer chip as the menu's I'm a reviewer", () => {
    expect(restoredReviewerFilter({ reviewerIsMe: true })).toEqual({ reviewer: 'me' });
    expect(restoredReviewerFilter({ reviewerIsMe: false })).toEqual({});
    expect(restoredReviewerFilter({ reviewer: 'waitingForMe' })).toEqual({});
  });
});

describe("Code reviews' Clear filters", () => {
  it('turns the reviewer filter and the status off too, keeping the time range', () => {
    const store = useCodeReviewsViewStore;
    store.getState().update({ text: '', people: EVERYONE, status: 'Reviewed', reviewer: 'anyone', since: 'lastYear' });
    expect(isFiltering(store.getState(), CLEARED_CODE_REVIEW_FILTERS)).toBe(true);

    store.getState().update({ people: MINE, reviewer: 'waitingForMe' });
    store.getState().clear();

    const { text, people, status, reviewer, since } = store.getState();
    expect({ text, people, status, reviewer, since }).toEqual({ text: '', people: EVERYONE, status: 'any', reviewer: 'anyone', since: 'lastYear' });
    expect(isFiltering(store.getState(), CLEARED_CODE_REVIEW_FILTERS)).toBe(false);
  });
});

describe('reviewerChoices', () => {
  it('counts the reviews waiting for the user beside Waiting for me', () => {
    expect(reviewerChoices(2).map((choice) => choice.label)).toEqual(['Any reviewer', "I'm a reviewer", 'Waiting for me · 2']);
    expect(reviewerChoices(0).at(-1)?.label).toBe('Waiting for me');
  });
});

describe('reviewerChipDot', () => {
  it('marks the reviewer chip while reviews wait for the user and another choice shows', () => {
    expect(reviewerChipDot('anyone', 2)).toBe('2 reviews waiting for you');
    expect(reviewerChipDot('me', 1)).toBe('1 review waiting for you');
  });

  it('marks nothing when none waits, or Waiting for me shows them already', () => {
    expect(reviewerChipDot('anyone', 0)).toBeUndefined();
    expect(reviewerChipDot('waitingForMe', 2)).toBeUndefined();
  });
});
