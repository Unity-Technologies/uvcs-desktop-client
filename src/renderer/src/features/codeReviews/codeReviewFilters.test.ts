import '../../testing/fakeWindow';
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
    expect(compactFilter(codeReviewsQuery({ since: 'last3Months', people: EVERYONE, status: 'any', assignedToMe: false }, today))).toEqual({ sinceDate: '2026-06-26' });
  });

  it('puts who created them, the assignment and the status into the query', () => {
    expect(codeReviewsQuery({ since: 'anyTime', people: { mine: true, others: ['zoe', 'ana'] }, status: 'Reviewed', assignedToMe: true }, today)).toEqual({
      owners: ['me', 'ana', 'zoe'],
      assignedToMe: true,
      status: 'Reviewed',
      sinceDate: undefined,
    });
  });
});

describe('the code reviews filter', () => {
  const review: CodeReview = {
    id: 31,
    title: 'Login screen',
    status: 'Under review',
    owner: 'ana.diaz',
    assignee: 'bob.smith',
    date: '',
    target: { kind: 'branch', branch: '/main/login' },
  };
  const matches = (search: string, shown = review) => matchesWordFilter(reviewFilterTexts(shown), search);

  it('looks through the number, title, target, author and reviewer', () => {
    expect(['31', 'login screen', '/main/login', 'Ana Diaz', 'Bob Smith', 'bob.smith'].every((search) => matches(search))).toBe(true);
    expect(matches('checkout')).toBe(false);
  });

  it('reads a review nobody is assigned to', () => {
    expect(matches('login', { ...review, assignee: '' })).toBe(true);
  });
});

describe("Code reviews' Clear filters", () => {
  it('turns Assigned to me and the status off too, keeping the time range', () => {
    const store = useCodeReviewsViewStore;
    store.getState().update({ text: '', people: EVERYONE, status: 'Reviewed', assignedToMe: false, since: 'lastYear' });
    expect(isFiltering(store.getState(), CLEARED_CODE_REVIEW_FILTERS)).toBe(true);

    store.getState().update({ people: MINE, assignedToMe: true });
    store.getState().clear();

    const { text, people, status, assignedToMe, since } = store.getState();
    expect({ text, people, status, assignedToMe, since }).toEqual({ text: '', people: EVERYONE, status: 'any', assignedToMe: false, since: 'lastYear' });
    expect(isFiltering(store.getState(), CLEARED_CODE_REVIEW_FILTERS)).toBe(false);
  });
});
