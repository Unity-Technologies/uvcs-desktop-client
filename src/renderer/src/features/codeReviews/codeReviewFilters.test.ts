import '../../testing/fakeWindow';
import { codeReviewSummary } from '../../testing/codeReviewSummary';
import { describe, expect, it } from 'vitest';
import type { CodeReview } from '@shared/domain/codeReview';
import { compactFilter } from '../../lib/compactFilter';
import { matchesWordFilter } from '../../lib/matchesAllWords';
import { EVERYONE, MINE } from '../../lib/peopleFilter';
import { isFiltering } from '../../lib/viewFilters';
import { codeReviewsQuery, reviewFilterTexts } from './codeReviewFilters';
import { CLEARED_CODE_REVIEW_FILTERS, useCodeReviewsViewStore } from './codeReviewsViewStore';

const today = new Date(2026, 8, 25);

describe('what Code reviews asks the server for', () => {
  it('asks by date alone with the defaults (the last three months), whatever the status or assignment left out', () => {
    expect(compactFilter(codeReviewsQuery({ since: 'last3Months', people: EVERYONE, status: 'any', reviewerIsMe: false }, today))).toEqual({ sinceDate: '2026-06-26' });
  });

  it('puts who created them, the assignment and the status into the query', () => {
    expect(codeReviewsQuery({ since: 'anyTime', people: { mine: true, others: ['zoe', 'ana'] }, status: 'Reviewed', reviewerIsMe: true }, today)).toEqual({
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

describe("Code reviews' Clear filters", () => {
  it("turns I'm a reviewer and the status off too, keeping the time range", () => {
    const store = useCodeReviewsViewStore;
    store.getState().update({ text: '', people: EVERYONE, status: 'Reviewed', reviewerIsMe: false, since: 'lastYear' });
    expect(isFiltering(store.getState(), CLEARED_CODE_REVIEW_FILTERS)).toBe(true);

    store.getState().update({ people: MINE, reviewerIsMe: true });
    store.getState().clear();

    const { text, people, status, reviewerIsMe, since } = store.getState();
    expect({ text, people, status, reviewerIsMe, since }).toEqual({ text: '', people: EVERYONE, status: 'any', reviewerIsMe: false, since: 'lastYear' });
    expect(isFiltering(store.getState(), CLEARED_CODE_REVIEW_FILTERS)).toBe(false);
  });
});
