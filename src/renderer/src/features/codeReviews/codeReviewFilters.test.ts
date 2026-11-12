import '../../testing/fakeWindow';
import { codeReviewSummary } from '../../testing/codeReviewSummary';
import { describe, expect, it } from 'vitest';
import type { CodeReview } from '@shared/domain/codeReview';
import { compactFilter } from '../../lib/compactFilter';
import { matchesWordFilter } from '../../lib/matchesAllWords';
import { EVERYONE, MINE } from '../../lib/peopleFilter';
import { isFiltering } from '../../lib/viewFilters';
import { codeReviewsQuery, matchesReviewers, matchesWaiting, reviewFilterTexts, waitingChipLabel } from './codeReviewFilters';
import { CLEARED_CODE_REVIEW_FILTERS, restoredReviewersFilter, useCodeReviewsViewStore } from './codeReviewsViewStore';

const today = new Date(2026, 8, 25);

const ASKED = { since: 'last3Months', people: EVERYONE, status: 'any', reviewers: EVERYONE, waitingForMe: false } as const;

describe('what Code reviews asks the server for', () => {
  it('asks by date alone with the defaults (the last three months), whatever the status or assignment left out', () => {
    expect(compactFilter(codeReviewsQuery(ASKED, today))).toEqual({ sinceDate: '2026-06-26' });
  });

  it("asks the server for the user's reviews when I'm a reviewer is alone, and for every review when others are picked, kept locally", () => {
    expect(codeReviewsQuery({ ...ASKED, reviewers: MINE }, today).reviewerIsMe).toBe(true);
    expect(compactFilter(codeReviewsQuery({ ...ASKED, reviewers: { mine: true, others: ['zoe'] } }, today))).toEqual(compactFilter(codeReviewsQuery(ASKED, today)));
    expect(compactFilter(codeReviewsQuery({ ...ASKED, reviewers: { mine: false, others: ['zoe'] } }, today))).toEqual(compactFilter(codeReviewsQuery(ASKED, today)));
  });

  it('reads every date under Waiting for me: a review waiting for the user for months still waits', () => {
    expect(codeReviewsQuery({ ...ASKED, waitingForMe: true }, today).sinceDate).toBeUndefined();
  });

  it('puts who created them, the assignment and the status into the query', () => {
    expect(codeReviewsQuery({ since: 'anyTime', people: { mine: true, others: ['zoe', 'ana'] }, status: 'Reviewed', reviewers: MINE, waitingForMe: false }, today)).toEqual({
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

describe('the reviewers filter', () => {
  const byZoe = codeReviewSummary({ id: 1, owner: 'dan', reviewers: [{ name: 'zoe', status: 'Under review' }] });
  const byAna = codeReviewSummary({ id: 2, owner: 'dan', reviewers: [{ name: 'ana', status: 'Reviewed' }, { name: 'bob', status: 'Under review' }] });
  const nobody = codeReviewSummary({ id: 3, owner: 'dan', reviewers: [] });
  const kept = (pick: Parameters<typeof matchesReviewers>[1]) => [byZoe, byAna, nobody].filter((review) => matchesReviewers(review, pick, 'ana')).map((review) => review.id);

  it('keeps every review with nobody picked', () => {
    expect(kept(EVERYONE)).toEqual([1, 2, 3]);
  });

  it("keeps the reviews any picked reviewer is asked on, the user's under I'm a reviewer", () => {
    expect(kept({ mine: false, others: ['zoe'] })).toEqual([1]);
    expect(kept({ mine: true, others: ['zoe'] })).toEqual([1, 2]);
    expect(kept(MINE)).toEqual([2]);
  });
});

describe('Waiting for me', () => {
  const asked = codeReviewSummary({ id: 1, owner: 'zoe', reviewers: [{ name: 'ana', status: 'Under review' }] });
  const reviewed = codeReviewSummary({ id: 2, owner: 'zoe', reviewers: [{ name: 'ana', status: 'Reviewed' }] });
  const ownInRework = codeReviewSummary({ id: 3, owner: 'ana', status: 'Rework required', openIssueCount: 2 });

  it('keeps the reviews waiting for the user, their own ones in rework too', () => {
    expect([asked, reviewed, ownInRework].filter((review) => matchesWaiting(review, true, 'ana')).map((review) => review.id)).toEqual([1, 3]);
  });

  it('keeps every row while off, and nothing waiting while the user is still unknown', () => {
    expect([asked, reviewed, ownInRework].every((review) => matchesWaiting(review, false, 'ana'))).toBe(true);
    expect(matchesWaiting(asked, true, undefined)).toBe(false);
  });

  it('counts the reviews waiting on its chip', () => {
    expect([waitingChipLabel(0), waitingChipLabel(2)]).toEqual(['Waiting for me', 'Waiting for me · 2']);
  });
});

describe('the reviewer filter remembered by an older version', () => {
  it("reads the I'm a reviewer chip as I'm a reviewer among the reviewers", () => {
    expect(restoredReviewersFilter({ reviewerIsMe: true })).toEqual({ reviewers: MINE });
    expect(restoredReviewersFilter({ reviewerIsMe: false })).toEqual({});
  });
});

describe("Code reviews' Clear filters", () => {
  it('turns the reviewers, Waiting for me and the status off too, keeping the time range', () => {
    const store = useCodeReviewsViewStore;
    store.getState().update({ text: '', people: EVERYONE, status: 'Reviewed', reviewers: EVERYONE, waitingForMe: false, since: 'lastYear' });
    expect(isFiltering(store.getState(), CLEARED_CODE_REVIEW_FILTERS)).toBe(true);

    store.getState().update({ people: MINE, reviewers: { mine: false, others: ['zoe'] }, waitingForMe: true });
    store.getState().clear();

    const { text, people, status, reviewers, waitingForMe, since } = store.getState();
    expect({ text, people, status, reviewers, waitingForMe, since }).toEqual({ text: '', people: EVERYONE, status: 'any', reviewers: EVERYONE, waitingForMe: false, since: 'lastYear' });
    expect(isFiltering(store.getState(), CLEARED_CODE_REVIEW_FILTERS)).toBe(false);
  });
});
